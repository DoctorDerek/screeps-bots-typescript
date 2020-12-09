export const actionBuild = (creep: Creep) => {
  // Build a structure (i.e. a road) if we are close to one
  let targetConstructionSite = creep.pos.findClosestByPath(
    FIND_CONSTRUCTION_SITES
  )
  // It's FIND_CONSTRUCTION_SITES and not FIND_MY_CONSTRUCTION_SITES
  // because roads and containers are not owned structres.
  if (!targetConstructionSite) {
    const allConstructionSites: ConstructionSite[] = []
    // There's no construction site in the creep's current room
    for (const room of Object.values(Game.rooms)) {
      allConstructionSites.push(...room.find(FIND_CONSTRUCTION_SITES))
    }
    allConstructionSites.sort((a, b) => {
      if (a.room && b.room) {
        return (
          Game.map.getRoomLinearDistance(creep.room.name, a.room.name) -
          Game.map.getRoomLinearDistance(creep.room.name, b.room.name)
        )
      }
      return Infinity
    })
    targetConstructionSite = allConstructionSites[0]
  }
  if (targetConstructionSite) {
    // There is a construction site somewhere for us to work on
    const buildResult = creep.build(targetConstructionSite)
    switch (buildResult) {
      // Move to the nearest one
      case ERR_NOT_IN_RANGE: // The target is too far away.
        creep.moveTo(targetConstructionSite, {
          visualizePathStyle: { stroke: "#ffffff" },
        })
        break

      // Do nothing cases
      case OK: // The operation has been scheduled successfully.
        break

      // Unhandled cases
      case ERR_NOT_OWNER: // You are not the owner of this creep.
      case ERR_BUSY: // The creep is still being spawned.
      case ERR_NOT_ENOUGH_RESOURCES: // The creep does not have any carried energy.
      case ERR_INVALID_TARGET: // The target is not a valid construction site object or the structure cannot be built here (probably because of a creep at the same square).
      case ERR_NO_BODYPART: // There are no WORK body parts in this creep’s body.
      default:
        console.log(
          `Unexpected error in build routine: ${buildResult} by ${creep.name}`
        )
    }
  } else {
    console.log(`${creep.name} had no construction site anywhere`)
    // STATE TRANSITION: BUILD --> REPAIR
    creep.memory.state = "REPAIR"
  }
}
