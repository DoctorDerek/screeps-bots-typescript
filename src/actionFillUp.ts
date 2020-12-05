import { lookForAtAreaWithOffset } from "helper_functions"

export const actionFillUp = (creep: Creep) => {
  // Look for tombstones around current position
  const TOMBSTONE_OFFSET = 1 // we can withdraw from adjacent tombstones
  const tombstonesAtCurrentPosition = lookForAtAreaWithOffset(
    creep,
    TOMBSTONE_OFFSET,
    LOOK_TOMBSTONES
  )
  if (tombstonesAtCurrentPosition.length > 0) {
    for (const aTombstone of tombstonesAtCurrentPosition) {
      const { tombstone } = aTombstone
      if (tombstone.store.energy > 0) {
        const withdrawResult = creep.withdraw(tombstone, RESOURCE_ENERGY)
        if (withdrawResult !== OK) {
          console.log(
            `Creep ${creep.name} had tombstone withdrawal error ${withdrawResult}`
          )
        }
      }
    }
  } else {
    // Look for resources dropped around current position
    const RESOURCE_OFFSET = 1 // we can pickup adjacent resources
    const resourcesAtCurrentPosition = lookForAtAreaWithOffset(
      creep,
      RESOURCE_OFFSET,
      LOOK_RESOURCES
    )
    if (resourcesAtCurrentPosition.length > 0) {
      for (const aResource of resourcesAtCurrentPosition) {
        const pickupResult = creep.pickup(aResource.resource)
        if (pickupResult === ERR_FULL) {
          // ignore this error, happens occasionally for unknown reason
        } else if (pickupResult !== OK) {
          console.log(`Creep ${creep.name} had pickup error ${pickupResult}`)
        }
      }
    }
    // transfer our energy to adjacent creeps if we can
    const TRANSFER_RANGE = 1
    const adjacentCreeps = creep.room.lookForAtArea(
      "creep",
      creep.pos.y - TRANSFER_RANGE,
      creep.pos.x - TRANSFER_RANGE,
      creep.pos.y + TRANSFER_RANGE,
      creep.pos.x + TRANSFER_RANGE,
      true // asArray
    )
    if (adjacentCreeps.length > 0) {
      for (const adjacent of adjacentCreeps) {
        if (adjacent.creep.memory.state === "DEPOSIT") {
          const transferResult = adjacent.creep.transfer(creep, RESOURCE_ENERGY)
        }
      }
    }
    if (creep.store.getFreeCapacity() === 0) {
      // we are full after transferring so let's deposit
      // STATE TRANSITION: FILL UP --> DEPOSIT
      creep.memory.state = "DEPOSIT"
    } else {
      {
        // We should compare the amount of all energy sources in the room
        // Specifically: dropped resources and energy stored in containers
        const allEnergySources: (StructureContainer | Resource)[] = []

        // Loop through all the romos that we have vision of
        for (const roomWithVision of Object.values(Game.rooms)) {
          // First we compile a list of all the containers we could withdraw from
          const allContainers = roomWithVision.find(FIND_STRUCTURES, {
            filter: (structure) => {
              return structure.structureType === STRUCTURE_CONTAINER
            },
          })
          for (const container of allContainers) {
            if (container.structureType === STRUCTURE_CONTAINER) {
              allEnergySources.push(container)
            }
          }

          // Maybe there are some dropped resources we can go grab
          const allDroppedResources = roomWithVision.find(
            FIND_DROPPED_RESOURCES
          )
          for (const resource of allDroppedResources) {
            if (resource.resourceType === RESOURCE_ENERGY) {
              allEnergySources.push(resource)
            }
          }
        }

        // Sort the available energy sources
        const sortedEnergySources = _.sortBy(allEnergySources, (source) => {
          let storedEnergy: number = 0
          if ("store" in source) {
            // Stored energy resource in a container in this room
            storedEnergy = source.store.energy
          }
          if ("amount" in source) {
            // Dropped energy resource in this room
            storedEnergy = source.amount * 2
            // Dropped resources are more important than stored resources because
            // they decay, so they get a times 2 multiplier in calculations
          }
          // Calculate the range; for the current room we can use pos.getRangeTo()
          // but for other rooms we need Game.map.getRoomLinearDistance() * 50
          const range =
            source.pos.roomName === creep.room.name
              ? creep.pos.getRangeTo(source.pos)
              : 50 *
                Game.map.getRoomLinearDistance(
                  source.pos.roomName,
                  creep.room.name
                )
          // Sort order is the amount of energy squared divided by the range plus 1
          return 0 - storedEnergy ** 2 / (range + 1)
          // Zero minus is descending sort
        })

        const targetFillUpSite = sortedEnergySources[0]

        if (targetFillUpSite) {
          if ("store" in targetFillUpSite) {
            // Stored energy resource in a container in this room
            if (
              creep.withdraw(targetFillUpSite, RESOURCE_ENERGY) ===
              ERR_NOT_IN_RANGE
            ) {
              creep.moveTo(targetFillUpSite, {
                visualizePathStyle: { stroke: "#ffaa00" },
              })
            }
          }
          if ("amount" in targetFillUpSite) {
            // Dropped energy resource in this room
            const pickupResult = creep.pickup(targetFillUpSite)
            if (pickupResult === ERR_NOT_IN_RANGE) {
              creep.moveTo(targetFillUpSite, {
                visualizePathStyle: { stroke: "#ffaa00" },
              })
            } else if (pickupResult === ERR_FULL) {
              // ignore this error
            } else if (pickupResult !== OK) {
              console.log(
                `Creep ${creep.name} had pickup error ${pickupResult}`
              )
            }
          }
        }
      }
    }
  }
}
