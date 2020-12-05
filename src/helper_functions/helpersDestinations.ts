// TODO: Write jsDoc documentation for helper functions for my sanity:)
// TODO: Move this to a helper function that gets reused in many creeps
// Because it assigns them a destination in memory that is the closest

// TODO: Fix this logic -- currently not checking for creeps already assigned to that destination

import { getMineablePositionsInAllRoomsWithVision } from "./helpersMining"
import {
  getAccessibleRoomNamesWithoutVision,
  getAccessibleAdjacentRoomNames,
  getAccessibleRoomNamesWithVision,
} from "./helpersRoomNames"

// exit tile by path to go to the specified destination room
export const assignDestination = (
  destinationRoomName: string,
  creep: Creep
) => {
  const exitDirection = creep.room.findExitTo(destinationRoomName)
  // TODO Check destination tile to see if it's a valid position (not a wall)
  const exitPosition =
    (exitDirection === FIND_EXIT_TOP ||
      exitDirection === FIND_EXIT_RIGHT ||
      exitDirection === FIND_EXIT_BOTTOM ||
      exitDirection === FIND_EXIT_LEFT) &&
    creep.pos.findClosestByPath(exitDirection)
  if (exitPosition) {
    creep.memory.destination.x = exitPosition.x
    creep.memory.destination.y = exitPosition.y
    creep.memory.destination.roomName = creep.room.name
  } else {
    console.log(
      `${creep.name} with role ${creep.memory.role} could not find the exit direction ${exitDirection} which is ERR_NO_PATH (${ERR_NO_PATH})`
    )
  }
  creep.say(`🚶(${creep.memory.destination.x},${creep.memory.destination.y})`)
}

// Choose an appropriate destination in this room based on creep's role
export const chooseDestination = (creep: Creep) => {
  const DEBUG = false
  if (creep.memory.role === "Eye") {
    const accessibleRoomNamesWithoutVision: Array<string> = getAccessibleRoomNamesWithoutVision(
      creep.room
    )
    if (accessibleRoomNamesWithoutVision.length > 0) {
      // There are accessible adjacent rooms without vision
      const randomRoomIndex = Math.floor(
        Math.random() * accessibleRoomNamesWithoutVision.length
      )
      DEBUG &&
        console.log(
          `Accessible Room Names without Vision:${creep.name} ${accessibleRoomNamesWithoutVision}; selected random index ${randomRoomIndex}`
        )
      const destinationRoomName =
        accessibleRoomNamesWithoutVision[randomRoomIndex]
      assignDestination(destinationRoomName, creep)
    } else {
      // There are not any accessible adjacent rooms without vision
      // In other words, I have vision of all adjacent accessible rooms
      const accessibleAdjacentRoomNames = getAccessibleAdjacentRoomNames(
        creep.room
      )
      const randomRoomNameIndex = Math.floor(
        Math.random() * accessibleAdjacentRoomNames.length
      )
      const destinationRoomName =
        accessibleAdjacentRoomNames[randomRoomNameIndex]
      assignDestination(destinationRoomName, creep)
    }
  }

  // TODO: Fix this logic -- currently not checking for creeps already assigned to that destination
  if (creep.memory.role === "Miner") {
    const accessibleRoomNamesWithVision: Array<string> = getAccessibleRoomNamesWithVision(
      creep.room
    )
    const unoccupiedMineablePositions = assignDestinationForMining(creep)
    if (unoccupiedMineablePositions === 0) {
      // All adjacent rooms didn't have anywhere available to mine
      // So just pick one randomly to go to
      const randomRoomIndex = Math.floor(
        Math.random() * accessibleRoomNamesWithVision.length
      )
      DEBUG &&
        console.log(
          "Accessible Room Names with Vision:",
          creep.name,
          ...accessibleRoomNamesWithVision,
          randomRoomIndex
        )
      const destinationRoomName = accessibleRoomNamesWithVision[randomRoomIndex]
      assignDestination(destinationRoomName, creep)
    }
  }

  // TODO Assign fetchers to other rooms
  if (creep.memory.role === "Taxi") {
    const accessibleRoomNamesWithoutVision: Array<string> = getAccessibleRoomNamesWithoutVision(
      creep.room
    )
    if (accessibleRoomNamesWithoutVision.length > 0) {
      // There are accessible adjacent rooms without vision
      const randomRoomIndex = Math.floor(
        Math.random() * accessibleRoomNamesWithoutVision.length
      )
      DEBUG &&
        console.log(
          "Accessible Room Names without Vision:",
          creep.name,
          ...accessibleRoomNamesWithoutVision,
          randomRoomIndex
        )
      const destinationRoomName =
        accessibleRoomNamesWithoutVision[randomRoomIndex]
      assignDestination(destinationRoomName, creep)
    } else {
      // There are not any accessible adjacent rooms without vision
      // In other words, I have vision of all adjacent accessible rooms
      const accessibleAdjacentRoomNames = getAccessibleAdjacentRoomNames(
        creep.room
      )
      const randomRoomNameIndex = Math.floor(
        Math.random() * accessibleAdjacentRoomNames.length
      )
      const destinationRoomName =
        accessibleAdjacentRoomNames[randomRoomNameIndex]
      assignDestination(destinationRoomName, creep)
    }
  }
}

export const assignDestinationForMining = (creep: Creep) => {
  const DEBUG = false

  const mineablePositions: RoomPosition[] = getMineablePositionsInAllRoomsWithVision()
  // TODO Count occupied mineable position in each surrounding room
  // Select an array of creeps with assigned destinations in this room:
  const creeps = Object.keys(Game.creeps).filter(
    (creepName) => creepName !== creep.name
  )
  /* removed: (Game.creeps[creepName].memory.role === "Harvester" ||
        Game.creeps[creepName].memory.role === "Miner") && */

  DEBUG && console.log("Found creeps:" + creeps.length)

  // TODO refactor to Set or Map
  const occupiedMineablePositions: RoomPosition[] = []
  creeps.forEach((creepName) => {
    // Actually occupied positions
    occupiedMineablePositions.push(
      new RoomPosition(
        Game.creeps[creepName].pos.x,
        Game.creeps[creepName].pos.y,
        Game.creeps[creepName].room.name
      )
    )
    // Designated mining positions (miner may be in transit)
    occupiedMineablePositions.push(
      new RoomPosition(
        Game.creeps[creepName].memory.destination.x,
        Game.creeps[creepName].memory.destination.y,
        Game.creeps[creepName].memory.destination.roomName
      )
    )
  })
  DEBUG && console.log(`Mineable: ${mineablePositions.length}`)

  // Use a Map object to filter out all the occupied positions
  const unoccupiedMineableMap = new Map<string, boolean>()
  mineablePositions.forEach((possiblePosition) => {
    unoccupiedMineableMap.set(
      `${possiblePosition.x},${possiblePosition.y},${possiblePosition.roomName}`,
      true
    )
  })
  occupiedMineablePositions.forEach((occupiedPosition) => {
    unoccupiedMineableMap.delete(
      `${occupiedPosition.x},${occupiedPosition.y},${occupiedPosition.roomName}`
    )
  })
  const unoccupiedMineablePositions: RoomPosition[] = []
  for (const stringPosition of unoccupiedMineableMap.keys()) {
    const regExp = /(?<x>\d+),(?<y>\d+),(?<roomName>\w+)/
    // Board is a 50x50 grid with coordinates ranging from 0 to 49 i.e. 1-2 digits
    const resultOfRegExp = regExp.exec(stringPosition)

    if (resultOfRegExp) {
      if (resultOfRegExp.groups) {
        const xCoordinate = Number(resultOfRegExp.groups.x) // e.g. 23
        const yCoordinate = Number(resultOfRegExp.groups.y) // e.g. 26
        const roomName = resultOfRegExp.groups.roomName
        unoccupiedMineablePositions.push(
          new RoomPosition(xCoordinate, yCoordinate, roomName)
        )
      }
    } else {
      console.log(`Failed RegExp exec on ${stringPosition}`)
    }
  }

  DEBUG && console.log(`Occupied: ${occupiedMineablePositions.length}`)
  DEBUG && console.log(`Unoccupied: ${unoccupiedMineablePositions.length}`)

  // The array mineablePositions now only includes available positions
  if (unoccupiedMineablePositions.length === 0) {
    // No available mining positions
    // --> Mission: EXPLORE
    // creep.memory.state = "EXPLORE"
    creep.memory.state = "THINK"
  } else {
    // Found at least 1 available mining position in the target room
    // --> Mission: MINE
    creep.memory.state = "MINE"
    // Pick the closest mineable position by range
    unoccupiedMineablePositions.sort((a, b) => {
      // Calculate the range; for the current room we can use pos.getRangeTo()
      // but for other rooms we need Game.map.getRoomLinearDistance() * 50
      return a.roomName === b.roomName
        ? creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b)
        : 50 *
            (Game.map.getRoomLinearDistance(creep.room.name, a.roomName) -
              Game.map.getRoomLinearDistance(creep.room.name, b.roomName))
    })
    const closestMineablePosition = unoccupiedMineablePositions[0]
    console.log(
      `Mineable positions: ${unoccupiedMineablePositions}; closest is (${closestMineablePosition.x},${closestMineablePosition.y})`
    )
    creep.memory.destination.x = closestMineablePosition.x
    creep.memory.destination.y = closestMineablePosition.y
    creep.memory.destination.roomName = closestMineablePosition.roomName
    console.log(
      `${creep.name} assigned mission to MINE from destination (${creep.memory.destination.x},${creep.memory.destination.y}) in room ${creep.memory.destination.roomName}`
    )
  }
  return unoccupiedMineablePositions.length
}
