import { actionFillUp } from "actionFillUp"
import { actionDeposit, dropIt } from "actionDeposit"
import { createPrivateKey } from "crypto"

export const assignTaxis = (taxi: Creep) => {
  // For each taxi: Find all creeps (in all rooms) who need a tow
  const DEBUG = false
  // find closest creep who needs a tow (no MOVE parts)
  const creepsNeedingTow = Array.from(Object.values(Game.creeps)).filter(
    (target: Creep) =>
      target.getActiveBodyparts(MOVE) === 0 &&
      (target.pos.x !== target.memory.destination.x ||
        target.pos.y !== target.memory.destination.y ||
        target.pos.roomName !== target.memory.destination.roomName)
  )

  // Sort creeps needing a tow by closest creep to this taxi
  // Calculate the range; for the current room we can use pos.getRangeTo()
  // but for other rooms we need Game.map.getRoomLinearDistance() * 50
  const rangeBetweenCreepsMultiRoom = (a: Creep, b: Creep) =>
    a.room.name === b.room.name
      ? a.pos.getRangeTo(b.pos)
      : 50 * Game.map.getRoomLinearDistance(a.room.name, b.room.name)
  // Sort by closest creep across multiple rooms
  creepsNeedingTow.sort(
    (a, b) =>
      rangeBetweenCreepsMultiRoom(taxi, a) -
      rangeBetweenCreepsMultiRoom(taxi, b)
  )

  if (creepsNeedingTow.length > 0) {
    DEBUG && console.log(`Creeps needing tow: ${creepsNeedingTow}`)
  }

  // For each creep that needs a tow:
  for (const creepNeedingTow of creepsNeedingTow) {
    if (creepNeedingTow.memory.taxiDriver) {
      if (taxi.name === creepNeedingTow.memory.taxiDriver) {
        // wait, this is our ride! save it to our memory as taxiDriver
        taxi.memory.taxiDriver = creepNeedingTow.name
        // no need to mess with the creep if we're already assigned to it
        continue
      }
      if (!Game.creeps[creepNeedingTow.memory.taxiDriver]) {
        // if the assigned taxidriver has died, clear the memory
        creepNeedingTow.memory.taxiDriver = ""
      }
      // this creep has an assigned driver in memory that isn't this taxi
      const otherTaxi = Game.creeps[creepNeedingTow.memory.taxiDriver]
      DEBUG &&
        console.log(
          `creepNeedingTow: ${creepNeedingTow.name}, taxi: ${
            taxi.name
          }, otherTaxi: ${
            otherTaxi && otherTaxi.name
          }, creepNeedingTow.memory.taxiDriver: ${
            creepNeedingTow.memory.taxiDriver
          } `
        )
      const rangeFromThisTaxi = rangeBetweenCreepsMultiRoom(
        taxi,
        creepNeedingTow
      )
      const rangeFromThatTaxi = rangeBetweenCreepsMultiRoom(
        otherTaxi,
        creepNeedingTow
      )
      if (rangeFromThisTaxi < rangeFromThatTaxi) {
        // If this taxi is closer than the assigned taxi,
        // then assign this taxi and unassign the other
        creepNeedingTow.memory.taxiDriver = taxi.name
        // This taxi should signal it's not available by saving
        // its own name to its memory for taxiDriver
        taxi.memory.taxiDriver = taxi.name
        // Unassign the other taxi driver, since this taxi is taking the job
        otherTaxi.memory.taxiDriver = ""
      }
    } else {
      // This taxi should only pick that creep up if it has no assigned taxi
      if (!creepNeedingTow.memory.taxiDriver) {
        // Assign this taxi to that creep if it has no assigned taxi
        creepNeedingTow.memory.taxiDriver = taxi.name
        // Turn the taxi light off because we have a job
        taxi.memory.taxiDriver = taxi.name
      }
    }
  }
}

export const moveAfterPull = (taxi: Creep, target: Creep) => {
  const DEBUG = false
  target.move(taxi) // get towed
  DEBUG && console.log(`target.move(creep) returned ${target.move(taxi)}`)
  if (
    taxi.pos.x === target.memory.destination.x &&
    taxi.pos.y === target.memory.destination.y &&
    taxi.pos.roomName === target.memory.destination.roomName
  ) {
    // switch places because we arrived
    taxi.move(taxi.pos.getDirectionTo(target))
    // Check to see if the target actually made it, in case there
    // is a fatigue issue
    if (
      target.pos.x === target.memory.destination.x &&
      target.pos.y === target.memory.destination.y &&
      target.pos.roomName === target.memory.destination.roomName
    ) {
      // remove this taxi driver from target's memory
      target.memory.taxiDriver = ""
      // this taxi driver is no longer working, so turn on
      // the taxi light with an empty string for taxiDriver
      taxi.memory.taxiDriver = ""
    }
  } else {
    taxi.moveTo(
      new RoomPosition(
        target.memory.destination.x,
        target.memory.destination.y,
        target.memory.destination.roomName
      )
    )
  }
}

export const actionTaxi = (taxi: Creep) => {
  const DEBUG = false
  const target = taxi.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: function (target: Creep) {
      // DEBUG && console.log(`${taxi.name} found ${target.name}`)
      /* DEBUG &&
      console.log(
        `${target.getActiveBodyparts(MOVE)} &&
            ((${target.pos.x} !== ${target.memory.destination.x} &&
            ${target.pos.y} !== ${target.memory.destination.y}) ||
            ${target.pos.roomName} !== ${target.memory.destination.roomName})`
      )*/
      return (
        target.getActiveBodyparts(MOVE) === 0 &&
        (target.pos.x !== target.memory.destination.x ||
          target.pos.y !== target.memory.destination.y ||
          target.pos.roomName !== target.memory.destination.roomName)
      )
    },
  })
  const taxiIsOnEdge =
    taxi.pos.x > 0 && taxi.pos.x < 49 && taxi.pos.y > 0 && taxi.pos.y < 49
  if (target && target.memory.taxiDriver === taxi.name) {
    // This taxi is the assigned driver for that creep, let's go tow
    DEBUG && console.log(`${taxi.name} is trying to tow ${target.name}`)

    // try to pull the target (we might not be in range)
    const pullResult = taxi.pull(target)

    // normal code (not on edges)
    if (taxiIsOnEdge) {
      // we're not on an edge, so go pickup our ride
      if (pullResult === ERR_NOT_IN_RANGE) {
        taxi.moveTo(target) // pickup ride
        DEBUG &&
          console.log(`creep.moveTo(target) returned ${taxi.moveTo(target)}`)
      } else {
        // pullResult === OK // ?
        moveAfterPull(taxi, target)
      }
    } else {
      // edge handling logic
      // Tick 1: Move onto edge with pulling creep pulling other creep next to edge
      // ^ this is the normal behavior, but we need to stay in tow mode
      if (pullResult === ERR_NOT_IN_RANGE) {
        // Tick 2: Do nothing (because we teleported and the target didn't)
        // We're on an edge, but our passenger isn't with us
        DEBUG && console.log(`${taxi.name} is waiting to teleport back`)
      } else {
        // Tick 3: Pulling creep is back in the room with the other creep
        // The trick is to move to the creep object that you're pulling
        DEBUG && console.log(`${taxi.name} is at an edge`)
        target.move(taxi) // get towed
        //taxi.move(taxi.pos.getDirectionTo(target)) // switch places
        // If we just arrived at the edge, then walk along it
        if (taxi.memory.taxiDriver === taxi.name) {
          // we just arrived
          if (taxi.pos.x === 0 || taxi.pos.x === 49) {
            // left edge, right edge
            taxi.move(TOP)
            taxi.move(BOTTOM)
          }
          if (taxi.pos.y === 0 || taxi.pos.y === 49) {
            // bottom edge, top edge
            taxi.move(LEFT)
            taxi.move(RIGHT)
          }
          // save the old room as the taxiDriver in memory temporarily
          taxi.memory.taxiDriver = taxi.room.name
        } else {
          // we are in the other room and need to move off the edge
          // which is the normal logic
          moveAfterPull(taxi, target)
          // since we've transited, remove the old room from memory
          taxi.memory.taxiDriver = taxi.memory.taxiDriver
        }
        // Tick 4: Pulled creep is now through to the other room.
        // (Since we're out of range, our normal code will move to that room)
        // Tick 5: Passenger isn't with us
        // Tick 6: Pull other creep off room edge.
      }
    }
    /*
    Tick 1: Move onto edge with pulling creep pulling other creep next to edge
    Tick 2: Do nothing
    Tick 3: Pulling creep is back in the room with the other creep. Now you have to issue a valid move intent to enable the pull. This is nasty. You cannot move "into the wall", you have to either move along the room edge or move back into the room you just came from. Going to assume you move along the room edge as I think moving into the room you just came from adds a tick.
    Tick 4: Pulled creep is now through to the other room. If the pulling creep moved along the room edge it is also. Pulling creep moves into the room further.
    Tick 5: Do nothing
    Tick 6: Pull other creep off room edge.
        [...]
    @Snowgoose on slack told me how to avoid the "Tick 3" intent issue. In the OP I complained because the game doesn't let you pull unless you move somewhere, which screws up when you have an "implicit" move by sitting still on an exit tile. You don't want to move anywhere though. You want to teleport back through.
    //
    The trick is to move to the creep object that you're pulling. That seems to confuse the game graphics a little (and maybe the engine), but gets the desired behaviour of pulling using the implicit teleportation.
    //
    I still think we should be allowed ot issue move intents into the room edge and have pull complete.
    // Tigga from https://screeps.com/forum/topic/2808/pull-across-room-boundaries
    */
  } else {
    if (!taxiIsOnEdge) {
      // We're not working right now, so let's be sure our taxi
      // light is on with the empty string saved as taxiDriver
      taxi.memory.taxiDriver = ""
    } else {
      // There's a chance we're transiting between rooms
      console.log(
        `${taxi.name} has taxiDriver in memory of ${taxi.memory.taxiDriver}`
      )
    }
  }
}

export const roleTaxi = {
  run(taxi: Creep) {
    if (taxi.getActiveBodyparts(MOVE) === 0) {
      taxi.suicide() // we probably sustained damage
    }
    if (taxi.memory.state === "THINK") {
      taxi.say("⛽ FILL UP")
      taxi.memory.state = "FILL UP"
    }
    if (taxi.memory.state === "FILL UP") {
      if (taxi.store.getUsedCapacity() === 0) {
        // Make a taxi run if anyone needs it
        assignTaxis(taxi)
        // STATE TRANSITION: FILL UP --> TAXI
        if (taxi.memory.taxiDriver !== "") {
          taxi.say("🚕TAXI🚖")
          taxi.memory.state = "TAXI"
        }
      }
      // Go pick up resources from containers and the floor
      actionFillUp(taxi)
      // STATE TRANSITION: FILL UP --> DEPOSIT
      if (taxi.store.getUsedCapacity() / taxi.store.getCapacity() > 0.9) {
        taxi.say("🚶 DEPOSIT")
        taxi.memory.state = "DEPOSIT"
      }
    }
    if (taxi.memory.state === "TAXI") {
      actionTaxi(taxi)
      if (taxi.store.getUsedCapacity() > 0) {
        dropIt(taxi, "🚕TAXI🚖") // drop any energy we might be carrying
      }
      if (taxi.memory.taxiDriver === "") {
        taxi.say("⛽ FILL UP")
        taxi.memory.state = "FILL UP"
      }
    }
    if (
      taxi.memory.state === "DEPOSIT" ||
      taxi.memory.state === "SWAMP DEPOSIT"
    ) {
      // Go deposit current load
      actionDeposit(taxi)
    }
    if (taxi.memory.state === "DEPOSIT" && taxi.store.getUsedCapacity() === 0) {
      // STATE TRANSITION: DEPOSIT --> FILL UP
      taxi.memory.destination = new RoomPosition(25, 25, taxi.room.name)
      taxi.say("🚶 FILL UP")
      taxi.memory.state = "FILL UP"
    }
  },
}
