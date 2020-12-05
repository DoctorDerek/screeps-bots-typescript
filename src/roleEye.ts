import { actionPatrol } from "actionPatrol"
import {
  moveToDestination,
  getAccessibleRoomNamesWithoutVision,
  getRoomNameBasedOnExitCoordinates,
  chooseDestination,
} from "helper_functions"

const DEBUG = false

export const roleEye = {
  run(creep: Creep) {
    // TODO: Add if there's an enemy in this room I need to go home

    if (creep.memory.state === "EXPLORE") {
      // STATE TRANSITION: EXPLORE --> THINK
      // WHEN THE CURRENT DESTINATION IS NO LONGER VALID
      // Such as when it has transited into a new room
      // OR it realizes we now have vision of the new room
      if (creep.room.name !== creep.memory.destination.roomName) {
        // We've arrived in another room
        creep.memory.state = "THINK"
      }

      // STATE TRANSITION: EXPLORE --> THINK
      // WHEN WE HAVE VISION OF THIS EYE CREEP'S DESTINATION
      DEBUG &&
        console.log(
          `Creep ${creep.name} destination in memory (${creep.memory.destination.x},${creep.memory.destination.y}) in ${creep.memory.destination.roomName} and its current room is ${creep.room.name}`
        )
      const destinationRoomName = getRoomNameBasedOnExitCoordinates(
        creep.memory.destination.x,
        creep.memory.destination.y,
        new Room(creep.memory.destination.roomName)
      )
      DEBUG &&
        console.log(
          `Creep ${creep.name} has destination room name of ${destinationRoomName}`
        )
      const accessibleRoomNamesWithoutVision = getAccessibleRoomNamesWithoutVision(
        creep.room
      )
      DEBUG &&
        console.log(
          `According to creep ${creep.name}, these are the accessibleRoomNamesWithoutVision: ${accessibleRoomNamesWithoutVision}`
        )

      if (
        Game.rooms[destinationRoomName] &&
        accessibleRoomNamesWithoutVision.length > 0
      ) {
        console.log(
          `${creep.name} says we have vision of its destination room name, so it's going to pick a new destination`
        )
        // Wait a second, we have vision of the destination, so change it,
        // unless we have vision of all the possible destinations right now.
        creep.memory.state = "THINK"
      }
    }

    if (creep.memory.state === "THINK") {
      // STATE TRANSITION: EXPLORE --> OBSERVE
      // WHEN THIS EYE CREEP IS PROVIDING VISION
      if (
        creep.room.find(FIND_MY_CREEPS).length === 1 &&
        creep.room.find(FIND_MY_STRUCTURES).length === 0
      ) {
        // Stop exploring if this Eye creep is the only creep in the room
        // and don't have any owned structures, which means this creep is
        // giving us vision of the room right now
        creep.memory.state = "OBSERVE"
      } else {
        // STATE TRANSITION: THINK --> EXPLORE
        // WHEN THIS EYE CREEP NEEDS A NEW DESTINATION
        // Either this creep is brand new (initial state)
        // OR it has transitioned to a new room (after exploring)
        // OR it realizes we now have vision of the new room
        creep.memory.state = "EXPLORE"

        // STATE ACTION: CHOOSE A NEW DESTINATION
        chooseDestination(creep)
      }
    }

    if (creep.memory.state === "OBSERVE") {
      // STATE TRANSITION: OBSERVE --> THINK
      // WHEN SOMETHING ELSE IS PROVIDING VISION
      if (
        creep.room.find(FIND_MY_CREEPS).length !== 1 ||
        creep.room.find(FIND_MY_STRUCTURES).length !== 0
      ) {
        creep.memory.state = "THINK"
      }
      // STATE ACTION: ASSIGN DESTINATION TO THE MIDDLE OF THIS ROOM
      actionPatrol(creep)
    }

    // ALWAYS ACTION: MOVE TO THE DESTINATION
    // By this point, we'll always have a destination assigned
    moveToDestination(creep)
  },
}
