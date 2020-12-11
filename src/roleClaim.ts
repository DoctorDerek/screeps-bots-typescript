import { actionPatrol } from "actionPatrol"
import { moveToDestination } from "helper_functions"

export const roleClaim = {
  run(creep: Creep) {
    const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
    if (target) {
      creep.say("⚔️ attacking")
      console.log(`⚔️ attacking ⚔️ ${creep.name} ⚔️ ${target}`)
      if (creep.attack(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target)
      }
    } else {
      if (creep.memory.state === "THINK") {
        // we need a home base room (a miner to guard)
        const allMiners = Array.from(Object.values(Game.creeps)).filter(
          (creep) => creep.memory.role === "Miner"
        )

        if (allMiners.length > 0) {
          const myMiner =
            allMiners[Math.floor(Math.random() * allMiners.length)]
          creep.memory.destination.x = myMiner.pos.x
          creep.memory.destination.y = myMiner.pos.y
          creep.memory.destination.roomName = myMiner.pos.roomName
          creep.memory.state = "TRANSIT"
          console.log(
            `${creep.name} assigned to destination creep ${myMiner.name} at ${myMiner.pos.x},${myMiner.pos.y} in ${myMiner.room.name}`
          )
        }
      }
      if (creep.memory.state === "TRANSIT") {
        if (!Game.rooms[creep.memory.destination.roomName]) {
          // we don't have vision of the destination
          creep.memory.state = "THINK"
        }
        moveToDestination(creep)
        if (creep.room.name === creep.memory.destination.roomName) {
          creep.memory.state = "GUARD"
        }
      }
      if (creep.memory.state === "GUARD") {
        // we have a home base to guard
        actionPatrol(creep)
      }
    }
  },
}
