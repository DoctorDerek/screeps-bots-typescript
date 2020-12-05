import { actionFillUp } from "actionFillUp"
import { actionDeposit } from "actionDeposit"

export const assignTaxis = (taxi: Creep) => {
  // For each taxi: Find all creeps (in all rooms) who need a tow
  const DEBUG = true
  // find closest creep who needs a tow (no MOVE parts)
  const creepsNeedingTow = Array.from(Object.values(Game.creeps)).filter(
    (target: Creep) =>
      target.getActiveBodyparts(MOVE) === 0 &&
      (target.pos.x !== target.memory.destination.x ||
        target.pos.y !== target.memory.destination.y ||
        target.pos.roomName !== target.memory.destination.roomName)
  )

  // Calculate the range; for the current room we can use pos.getRangeTo()
  // but for other rooms we need Game.map.getRoomLinearDistance() * 50
  const rangeBetweenCreepsMultiRoom = (a: Creep, b: Creep) =>
    a.room.name === b.room.name
      ? a.pos.getRangeTo(b)
      : 50 * Game.map.getRoomLinearDistance(a.room.name, b.room.name)
  // Sort those creeps by closest creep to this taxi
  // Sort by closest creep across multiple rooms
  creepsNeedingTow.sort(
    (a, b) =>
      rangeBetweenCreepsMultiRoom(taxi, a) -
      rangeBetweenCreepsMultiRoom(taxi, b)
  )

  console.log(`Creeps needing tow: ${creepsNeedingTow}`)

  // For each creep that needs a tow:
  for (const creepNeedingTow of creepsNeedingTow) {
    if (
      creepNeedingTow.memory.taxiDriver &&
      taxi.name !== creepNeedingTow.memory.taxiDriver
    ) {
      if (!Game.creeps[creepNeedingTow.memory.taxiDriver]) {
        // if the assigned taxidriver has died, clear the memory
        creepNeedingTow.memory.taxiDriver = ""
      }
      // this creep has an assigned driver in memory that isn't this taxi
      const otherTaxi = Game.creeps[creepNeedingTow.memory.taxiDriver]
      DEBUG &&
        console.log(
          `taxi: ${taxi.name}, otherTaxi: ${
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

export const actionTaxi = (taxi: Creep) => {
  const DEBUG = false
  const target = taxi.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: function (target: Creep) {
      DEBUG && console.log(`${taxi.name} found ${target.name}`)
      DEBUG &&
        console.log(
          `${target.getActiveBodyparts(MOVE)} &&
            ((${target.pos.x} !== ${target.memory.destination.x} &&
            ${target.pos.y} !== ${target.memory.destination.y}) ||
            ${target.pos.roomName} !== ${target.memory.destination.roomName})`
        )
      return (
        target.getActiveBodyparts(MOVE) === 0 &&
        (target.pos.x !== target.memory.destination.x ||
          target.pos.y !== target.memory.destination.y ||
          target.pos.roomName !== target.memory.destination.roomName)
      )
    },
  })
  if (target && target.memory.taxiDriver === taxi.name) {
    // This taxi is the assigned driver for that creep, let's go tow
    DEBUG && console.log(`${taxi.name} is trying to tow ${target.name}`)
    if (taxi.pull(target) === ERR_NOT_IN_RANGE) {
      taxi.moveTo(target) // pickup ride
      DEBUG &&
        console.log(`creep.moveTo(target) returned ${taxi.moveTo(target)}`)
    } else {
      target.move(taxi) // get towed
      DEBUG && console.log(`target.move(creep) returned ${target.move(taxi)}`)
      if (
        taxi.pos.x === target.memory.destination.x &&
        taxi.pos.y === target.memory.destination.y &&
        taxi.pos.roomName === target.memory.destination.roomName
      ) {
        // switch places because we arrived
        taxi.move(taxi.pos.getDirectionTo(target))
        // remove this taxi driver from target's memory
        target.memory.taxiDriver = ""
        // this taxi driver is no longer working, so turn on
        // the taxi light with an empty string for taxiDriver
        taxi.memory.taxiDriver = ""
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
  } else {
    // We're not working right now, so let's be sure our taxi
    // light is on with the empty string saved as taxiDriver
    taxi.memory.taxiDriver = ""
  }
}

export const roleTaxi = {
  run(taxi: Creep) {
    if (taxi.memory.state === "THINK") {
      taxi.say("⛽ FILL UP")
      taxi.memory.state = "FILL UP"
    }
    if (taxi.memory.state === "FILL UP") {
      // Make a taxi run if anyone needs it
      assignTaxis(taxi)
      // STATE TRANSITION: FILL UP --> TAXI
      if (taxi.memory.taxiDriver !== "") {
        taxi.say("🚕TAXI🚖")
        taxi.memory.state = "TAXI"
      } else {
        // Go pick up resources from containers and the floor
        actionFillUp(taxi)
        // STATE TRANSITION: FILL UP --> DEPOSIT
        if (taxi.store.getUsedCapacity() / taxi.store.getCapacity() > 0.9) {
          taxi.say("🚶 DEPOSIT")
          taxi.memory.state = "DEPOSIT"
        }
      }
    }
    if (taxi.memory.state === "TAXI") {
      actionTaxi(taxi)
      if (taxi.memory.taxiDriver === "") {
        taxi.say("⛽ FILL UP")
        taxi.memory.state = "FILL UP"
      }
    }
    if (taxi.memory.state === "DEPOSIT") {
      // Go deposit current load
      actionDeposit(taxi)
      if (taxi.store.getUsedCapacity() === 0) {
        // STATE TRANSITION: DEPOSIT --> FILL UP
        taxi.memory.destination = new RoomPosition(25, 25, taxi.room.name)
        taxi.say("🚶 FILL UP")
        taxi.memory.state = "FILL UP"
      }
    }
  },
}
