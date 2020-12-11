import { moveToDestination } from "helper_functions"

export const roleClaim = {
  run(creep: Creep) {
    if (creep.memory.state === "THINK") {
      creep.say("🧠THINK🧠")
      // we need a home base room (something to reserve)
      const roomNamesWithClaimCreep = Array.from(Object.keys(Game.creeps))
        .filter(
          (creepName) =>
            creepName !== creep.name &&
            Game.creeps[creepName].memory.role === "Claim"
        )
        .map((creepName) => Game.creeps[creepName].memory.destination.roomName)

      const roomsNeedingClaimCreep = Array.from(
        Object.values(Game.rooms)
      ).filter(
        (room) =>
          // there's no spawn
          room
            .find(FIND_MY_STRUCTURES)
            .filter((structure) => structure.structureType === "spawn")
            .length === 0 &&
          // and there's no Claim creep assigned to it
          !roomNamesWithClaimCreep.includes(room.name) &&
          // and there's a room controller to claim
          room.controller
      )

      if (roomsNeedingClaimCreep.length > 0) {
        // Pick a room at random
        const myRoom =
          roomsNeedingClaimCreep[
            Math.floor(Math.random() * roomsNeedingClaimCreep.length)
          ]
        const x = myRoom.controller ? myRoom.controller.pos.x : 25
        creep.memory.destination.x = x
        const y = myRoom.controller ? myRoom.controller.pos.y : 25
        creep.memory.destination.y = y
        creep.memory.destination.roomName = myRoom.name
        creep.memory.state = "TRANSIT"
        console.log(
          `${creep.name} assigned to destination room ${myRoom.name} at ${x},${y}`
        )
      }
    }
    if (creep.memory.state === "TRANSIT") {
      creep.say("🚡TRANSIT🚡")
      if (!Game.rooms[creep.memory.destination.roomName]) {
        // We don't have vision of the destination
        creep.memory.state = "THINK"
      }
      moveToDestination(creep)
      if (creep.room.name === creep.memory.destination.roomName) {
        creep.memory.state = "RESERVE"
      }
    }
    if (creep.memory.state === "RESERVE") {
      creep.say("💵RSRV🈯")
      // We have a controller to reserve
      if (creep.room.controller) {
        const reserveResult = creep.reserveController(creep.room.controller)
        if (reserveResult === ERR_NOT_IN_RANGE) {
          moveToDestination(creep)
        }
      } else {
        console.log(
          `${creep.name} said there's no controller in its room ${creep.room.name}`
        )
        creep.memory.state = "THINK"
      }
    }
  },
}
