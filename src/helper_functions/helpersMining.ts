import { getAccessibleRoomNamesWithVision } from "./helpersRoomNames"

export const getMineablePositionsInAllRoomsWithVision = () => {
  const mineablePositions: RoomPosition[] = []
  for (const room of Object.values(Game.rooms)) {
    mineablePositions.push(...getMineablePositions(room))
  }

  return mineablePositions
}

export const getMineablePositionsIncludingSurroundingRooms = (room: Room) => {
  const mineablePositions = getMineablePositions(room)
  const accessibleRoomNamesWithVision: string[] = getAccessibleRoomNamesWithVision(
    room
  )
  for (const accessibleRoomNameWithVision of accessibleRoomNamesWithVision) {
    mineablePositions.push(
      ...getMineablePositions(new Room(accessibleRoomNameWithVision))
    )
  }

  return mineablePositions

  /*
  // Unused code to check for unique positions (redundant)
  const mineablePositionsSet = new Set()
  const uniqueMineablePositions = []
  for (const mineablePosition of mineablePositions) {
    if (!mineablePositionsSet.has(String(mineablePosition))) {
      mineablePositionsSet.add(String(mineablePosition))
      uniqueMineablePositions.push(mineablePosition)
    }
  }

  console.log(`Unique mineable positions: ${uniqueMineablePositions}`)

  return uniqueMineablePositions*/
}

export const MAX_MINEABLE_POSITIONS_CLAIMED_ROOMS = 2
// 2 miners with 3 WORK parts max out a 3000 energy source
export const MAX_MINEABLE_POSITIONS_UNCLAIMED_ROOMS = 1
// 3 miners with 2 WORK parts each max out a 3000 energy source
// --> claimed rooms / reserved rooms: 3000 energy per source
// 1 miner with 2 WORK parts nearly max out a 1500 energy source
// --> unclaimed rooms: 1500 energy per source
// Every 1 WORK part mines 2 energy / tick, and energy sources
// regenerate every 300 game ticks, so every 1 WORK part can
// mine a total of 600 energy before the source regenerates.
export const getMineablePositions = (room: Room) => {
  // Make an array of valid destinations to mine sources
  const mineablePositions: RoomPosition[] = []
  // We assume an unclaimed room
  let maxMineablePositionsPerSource: number = MAX_MINEABLE_POSITIONS_UNCLAIMED_ROOMS
  if (room.controller) {
    const { owner, reservation } = room.controller
    if (owner || reservation) {
      const myUsername = "djD-REK"
      if (
        (owner && owner.username !== myUsername) ||
        (reservation && reservation.username !== myUsername)
      ) {
        // Someone else has claimed or resreved the room, so don't mine it
        return mineablePositions // empty array []
      } else {
        maxMineablePositionsPerSource = MAX_MINEABLE_POSITIONS_CLAIMED_ROOMS
      }
    }
  }

  // Select all sources from this room:
  const activeSources = room.find(FIND_SOURCES)
  const enemiesPresent: boolean =
    room.find(FIND_HOSTILE_CREEPS).length >= 2 ||
    room.find(FIND_HOSTILE_STRUCTURES).length >= 2
  // Don't run lone scout, but run from 2+ enemies or any 2 enemy structures
  if (enemiesPresent) {
    return mineablePositions // empty array []
  }
  activeSources.forEach((source) => {
    const sourceX = source.pos.x
    const sourceY = source.pos.y
    // Necessary for simulation mode to avoid source keeper mining:
    // Check for source keepers & their lairs nearby
    const RANGE_TO_LOOK_FOR_SOURCE_KEEPERS = 3
    let lookTop = sourceY - RANGE_TO_LOOK_FOR_SOURCE_KEEPERS
    let lookLeft = sourceX - RANGE_TO_LOOK_FOR_SOURCE_KEEPERS
    let lookBottom = sourceY + RANGE_TO_LOOK_FOR_SOURCE_KEEPERS
    let lookRight = sourceX + RANGE_TO_LOOK_FOR_SOURCE_KEEPERS
    // boundary checks
    lookTop = lookTop < 0 ? 0 : lookTop
    lookLeft = lookLeft < 0 ? 0 : lookLeft
    lookBottom = lookBottom > 49 ? 49 : lookBottom
    lookRight = lookRight > 49 ? 49 : lookRight
    const creepsLookArray = room.lookForAtArea(
      // lookForAtArea(type, top, left, bottom, right, [asArray])
      LOOK_CREEPS,
      lookTop,
      lookLeft,
      lookBottom,
      lookRight,
      true // asArray
    )

    const actualSourceKeepers = []

    creepsLookArray
      .filter(
        (positionAsJSON) =>
          positionAsJSON.creep.owner.username === "Source Keeper"
      )
      .forEach((creepPositionAsJSON) => {
        // Each item returned by lookForAtArea looks something like:
        // {"type":"terrain","terrain":"plain","x":24,"y":42}
        actualSourceKeepers.push(creepPositionAsJSON)
      })

    const rangeToLookForSourceKeeperLairs = 10
    const structuresLookArray = room.lookForAtArea(
      // lookForAtArea(type, top, left, bottom, right, [asArray])
      LOOK_STRUCTURES,
      sourceY - rangeToLookForSourceKeeperLairs,
      sourceX - rangeToLookForSourceKeeperLairs,
      sourceY + rangeToLookForSourceKeeperLairs,
      sourceX + rangeToLookForSourceKeeperLairs,
      true
    )

    structuresLookArray
      .filter(
        (positionAsJSON) =>
          positionAsJSON.structure.structureType === STRUCTURE_KEEPER_LAIR
      )
      .forEach((structurePositionAsJSON) => {
        // Each item returned by lookForAtArea looks something like:
        // {"type":"terrain","terrain":"plain","x":24,"y":42}
        actualSourceKeepers.push(structurePositionAsJSON)
      })

    if (actualSourceKeepers.length === 0) {
      // No Source Keepers so we can count this source as valid
      const terrainLookArray = room.lookForAtArea(
        // lookForAtArea(type, top, left, bottom, right, [asArray])
        LOOK_TERRAIN,
        sourceY - 1,
        sourceX - 1,
        sourceY + 1,
        sourceX + 1,
        true
      )
      let mineablePositionsForThisSource = 0
      terrainLookArray
        .filter((positionAsJSON) => positionAsJSON.terrain !== "wall")
        .forEach((mineablePositionAsJSON) => {
          if (mineablePositionsForThisSource < maxMineablePositionsPerSource) {
            // Each item returned by lookForAtArea looks like:
            // {"type":"terrain","terrain":"plain","x":24,"y":42}
            const { x, y } = mineablePositionAsJSON
            mineablePositions.push(new RoomPosition(x, y, room.name))
          }
          mineablePositionsForThisSource += 1
        })
    }
  })
  return mineablePositions
}
