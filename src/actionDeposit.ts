import { VISUALIZE_PATH_STYLE } from "./helper_functions/RANDOM_COLOR"

export const dropIt = (creep: Creep, why: string = "") => {
  console.log(`${creep.name} says, "Drop it!${why && " " + why}"`)
  creep.say("💧DROP IT!🩸")
  // There's an issue, so let's drop our resources and mosey on
  creep.drop(RESOURCE_ENERGY)
}

export const actionDeposit = (creep: Creep) => {
  const terrain = new Room.Terrain(creep.room.name)

  if (terrain.get(creep.pos.x, creep.pos.y) === TERRAIN_MASK_SWAMP) {
    // Drop energy as we traverse swamps; we'll pick it up next turn
    dropIt(creep, "Swamp!")
  }

  // Find a drop off site and move to it
  const targetDropOffSite = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        (structure.structureType === STRUCTURE_EXTENSION ||
          structure.structureType === STRUCTURE_SPAWN) &&
        structure.energy < structure.energyCapacity
      )
    },
  })
  /* TODO: Add container logic (unowned, thus different)
  if(targetDropOffSite===null) {
    // There is no extension or spawn, but maybe there is a contrainer
    targetDropOffSite = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => {
        return (
          (structure.structureType === STRUCTURE_CONTAINER &&
            _.sum(structure.store) < structure.storeCapacity)
        )
      },
    })
  }*/
  if (targetDropOffSite != null) {
    // There is somewhere to drop it off in the current room
    const transferResult = creep.transfer(targetDropOffSite, RESOURCE_ENERGY)
    if (
      transferResult === ERR_NOT_IN_RANGE ||
      transferResult === ERR_NOT_ENOUGH_RESOURCES
    ) {
      const moveResult = creep.moveTo(targetDropOffSite, {
        visualizePathStyle: VISUALIZE_PATH_STYLE,
        ignoreCreeps: false, //(default)
        //ignoreCreeps: Math.random() < 1 / 2 ? false : true,
        // don't ignore creeps when depositing (default is false)
        // this behavior makes creeps stick to the roads
        // which we want, since fetchers benefit from roads
        // on way back (full CARRY parts) but not on way out
        // however once-in-a-while we need to check for creeps
        // in case we got stuck with creeps all along the road
        reusePath: 5,
        // reuse path for 5 turns (default is 5)
      })
      if (moveResult === ERR_NO_PATH) {
        dropIt(creep, "There was no path. Let's try to leave.")
      } else if (moveResult !== OK && moveResult !== ERR_TIRED) {
        console.log(`${creep.name} had move error ${moveResult}`)
      }
    } else if (transferResult !== OK) {
      console.log(`${creep.name} had transfer error ${transferResult}`)
    }
  } else {
    // There is nowhere to drop it off in the current room
    // Move to within MAX_RANGE_TO_DROP_IT of the spawn.
    // Then we drop it if everything is full
    creep.moveTo(Game.spawns.Spawn1.pos, {
      visualizePathStyle: { stroke: "#ffffff" },
    })
    const MAX_RANGE_TO_DROP_IT = 2
    // a small number concentrates drops around the spawn
    if (
      creep.room === Game.spawns.Spawn1.room &&
      creep.pos.getRangeTo(Game.spawns.Spawn1.pos) < MAX_RANGE_TO_DROP_IT
    ) {
      dropIt(creep, "There are 0 available targets in the home room.")
    }
  }
}
