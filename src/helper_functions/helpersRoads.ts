import { getMineablePositions } from "./helpersMining"
import {
  getRoomsFromRoomNamesIfVision,
  getAccessibleAdjacentRoomNames,
} from "./helpersRoomNames"

export const MAX_CONTAINERS = 5 // hard max in any room
export const MAX_EXTENSIONS = [
  // depends on room RCL, which is the index of this array
  0,
  0,
  5,
  10,
  20,
  30,
  40,
  100,
  200,
]

export const countStructures = (type: "container" | "extension") => {
  // Count the containers because there's a maximum of 5 containers allowed
  let containersCount = Game.spawns.Spawn1.room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === type,
  }).length
  containersCount += Game.spawns.Spawn1.room.find(FIND_CONSTRUCTION_SITES, {
    filter: (constructionSite) => constructionSite.structureType === type,
  }).length
  return containersCount
}

export const planRoads = () => {
  // ROAD PLANNING LOGIC
  // ROAD PLANNING CHECK: Delete some roads every so often
  const DELETE_CONSTRUCTION_SITES_EVERY_X_TICKS = 100
  const DELETE_CONSTRUCTION_SITES =
    Game.time % DELETE_CONSTRUCTION_SITES_EVERY_X_TICKS === 0 ? true : false
  if (DELETE_CONSTRUCTION_SITES) {
    console.log(
      `DELETING ALL NOT YET STARTED CONSTRUCTION SITES (every ${DELETE_CONSTRUCTION_SITES_EVERY_X_TICKS} ticks)`
    )
    for (const room of Object.values(Game.rooms)) {
      for (const site of room.find(FIND_CONSTRUCTION_SITES)) {
        if (site.progress === 0) {
          site.remove()
        }
      }
    }
  }

  // ROAD PLANNING CHECK: Plan some roads every so often
  const PLAN_CONSTRUCTION_SITES_EVERY_X_TICKS = 10
  const MAX_CONSTRUCTION_SITES_PER_TICK = 10
  if (Game.time % PLAN_CONSTRUCTION_SITES_EVERY_X_TICKS === 0) {
    let constructionSitesPlannedThisTick = 0 // only plan some sites each tick
    console.log(
      `=== Road planning check (every ${PLAN_CONSTRUCTION_SITES_EVERY_X_TICKS} ticks) ===`
    )
    // Find the rooms accessible from this one (this room exits there)
    const accessibleAdjacentRoomsWithVision: Array<Room> = getRoomsFromRoomNamesIfVision(
      getAccessibleAdjacentRoomNames(Game.spawns.Spawn1.room)
    )
    // Create a terrain helper for quick lookups of terrain
    const terrain = new Room.Terrain(Game.spawns.Spawn1.room.name)

    // Count the extensions because there's a maximum allowed depending on RCL
    let extensionsCount = countStructures("extension")

    // Road planning logic part 0: Plan extensions (if available)
    // around the room's spawn (for ease of road access)
    const spawnPosition = Game.spawns.Spawn1.pos
    const RCL = Game.spawns.Spawn1.room.controller?.level
    if (spawnPosition) {
      const spawnX = spawnPosition.x
      const spawnY = spawnPosition.y

      RCL &&
        console.log(
          `RCL is ${RCL} so we can build ${MAX_EXTENSIONS[RCL]} extensions`
        )
      let offset = 0 // how far to search out from the room's spawn
      while (RCL && extensionsCount < MAX_EXTENSIONS[RCL]) {
        // offset increases until we've planned all extensions
        offset += 1
        console.log(`Planning extensions with offset ${offset}`)
        for (let x = spawnX - offset; x <= spawnX + offset; x++) {
          for (let y = spawnY - offset; y <= spawnY + offset; y++) {
            x = x > 48 ? 48 : x // boundary check (1 away from 0,49 board)
            x = x < 1 ? 1 : x
            y = y > 48 ? 49 : y // boundary check (1 away from 0,49 board)
            y = y < 1 ? 1 : y
            if (x % 2 === 0 && y % 2 === 1) {
              // build on even x & even y's only (checkerboard)
              y += 1 // make y even
            }
            if (x % 2 === 1 && y % 2 === 0) {
              // build on odd x & odd y's only (checkerboard)
              y += 1 // make y odd
            }

            // Only build extensions if all adjacent squares are plains
            let noSurroundingWalls = true
            for (
              let surroundingX = x - 1;
              surroundingX <= x + 1;
              surroundingX++
            ) {
              for (
                let surroundingY = y - 1;
                surroundingY <= y + 1;
                surroundingY++
              ) {
                if (
                  terrain.get(surroundingX, surroundingY) === TERRAIN_MASK_WALL
                ) {
                  // some surrounding terrain was a wall; invalid spot
                  noSurroundingWalls = false
                }
              }
            }

            // don't build directly adjacent to the spawn for traffic flow
            const notAdjacentToSpawn =
              Math.abs(x - spawnX) > 1 && Math.abs(y - spawnY) > 1

            if (noSurroundingWalls && notAdjacentToSpawn) {
              // Don't build extensions on walls
              switch (terrain.get(x, y)) {
                // No action cases
                case TERRAIN_MASK_WALL:
                  continue
                // Build road cases
                case 0: // plain
                case TERRAIN_MASK_SWAMP:
                default:
                  if (
                    constructionSitesPlannedThisTick <
                      MAX_CONSTRUCTION_SITES_PER_TICK &&
                    Game.spawns.Spawn1.room.createConstructionSite(
                      x,
                      y,
                      STRUCTURE_EXTENSION
                    ) === OK
                  ) {
                    extensionsCount++
                    constructionSitesPlannedThisTick++
                  }
                  break
              }
            }
          }
        }
      }
    }

    // Turn roads off until RCL 3
    const buildRoads =
      Game.spawns.Spawn1.room.controller &&
      Game.spawns.Spawn1.room.controller.level >= 3

    // Road planning logic part 1: For mineable positions in the current room
    // Find the mineable positions we want to build roads to
    const mineablePositions = getMineablePositions(Game.spawns.Spawn1.room)
    // Sort mineable positions by range from the creep spawn
    mineablePositions.sort(
      (a, b) =>
        Game.spawns.Spawn1.pos.getRangeTo(a) -
        Game.spawns.Spawn1.pos.getRangeTo(b)
    )

    // Count the containers because there's a maximum of 5 containers allowed
    let containersCount = countStructures("container")

    // Plan containers at each mineable position as well as
    // roads to and around each mineable position
    for (const mineablePosition of mineablePositions) {
      if (containersCount < MAX_CONTAINERS) {
        if (
          constructionSitesPlannedThisTick < MAX_CONSTRUCTION_SITES_PER_TICK &&
          Game.spawns.Spawn1.room.createConstructionSite(
            mineablePosition.x,
            mineablePosition.y,
            STRUCTURE_CONTAINER
          ) === OK
        ) {
          containersCount++
          constructionSitesPlannedThisTick++
        }
      }

      // Build roads to each mineable position
      const pathToMineablePosition = Game.spawns.Spawn1.pos.findPathTo(
        mineablePosition,
        {
          ignoreCreeps: true, // maybe should be true for road planning,
          // maxRooms: 1, // don't path through other rooms
        }
      )
      for (const [index, pathStep] of pathToMineablePosition.entries()) {
        if (index < pathToMineablePosition.length - 1) {
          // Here's the reason it's pathToMineablePosition.length - 1:
          // Don't build construction sites directly on top of sources and
          // don't build them within 2 range of sources (mining positions)
          if (
            constructionSitesPlannedThisTick <
              MAX_CONSTRUCTION_SITES_PER_TICK &&
            buildRoads &&
            Game.spawns.Spawn1.room.createConstructionSite(
              pathStep.x,
              pathStep.y,
              STRUCTURE_ROAD
            ) === OK
          ) {
            constructionSitesPlannedThisTick++
          }
        }
      }
    }

    // Road planning logic part 2: for creep Spawns
    const roomSpawns = Game.spawns.Spawn1.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType === "spawn",
    })
    const roomSpawnPositions = roomSpawns.map((aSpawn) => aSpawn.pos)
    // Plan roads to assist traffic around any Spawns in this room
    for (const roomSpawnPosition of roomSpawnPositions) {
      // Build roads completely surrounding each Spawn in this room
      for (let x = roomSpawnPosition.x - 1; x <= roomSpawnPosition.x + 1; x++) {
        for (
          let y = roomSpawnPosition.y - 1;
          y <= roomSpawnPosition.y + 1;
          y++
        ) {
          if (x === roomSpawnPosition.x && y === roomSpawnPosition.y) {
            // We don't want a road on the actual position of the Spawn
            continue
          }
          switch (terrain.get(x, y)) {
            // No action cases
            case TERRAIN_MASK_WALL:
              break
            // Build road cases
            case 0: // plain
            case TERRAIN_MASK_SWAMP:
            default:
              if (
                constructionSitesPlannedThisTick <
                  MAX_CONSTRUCTION_SITES_PER_TICK &&
                buildRoads &&
                Game.spawns.Spawn1.room.createConstructionSite(
                  x,
                  y,
                  STRUCTURE_ROAD
                ) === OK
              ) {
                constructionSitesPlannedThisTick++
              }
              break
          }
        }
      }
    }
    // Plan roads from spawn to room controller
    const controller = Game.spawns.Spawn1.room.controller
    if (controller) {
      const pathToController = Game.spawns.Spawn1.pos.findPathTo(controller, {
        ignoreCreeps: true, // maybe should be true for road planning,
        // maxRooms: 1,
      })
      for (const [index, pathStep] of pathToController.entries()) {
        if (index < pathToController.length - 4) {
          // Don't build construction sites within 3 range of controller
          // because the upgradeController command has 3 squares range
          if (
            constructionSitesPlannedThisTick <
              MAX_CONSTRUCTION_SITES_PER_TICK &&
            buildRoads &&
            Game.spawns.Spawn1.room.createConstructionSite(
              pathStep.x,
              pathStep.y,
              STRUCTURE_ROAD
            ) === OK
          ) {
            constructionSitesPlannedThisTick++
          }
        }
      }
    }

    // Road planning logic part 3: Build roads surrounding each mineable position
    for (const mineablePosition of mineablePositions) {
      // Build roads surrounding each mineablePosition
      for (let x = mineablePosition.x - 1; x <= mineablePosition.x + 1; x++) {
        for (let y = mineablePosition.y - 1; y <= mineablePosition.y + 1; y++) {
          if (x !== mineablePosition.x && y !== mineablePosition.y) {
            // Don't build roads on mineable positions,
            // since miners sit there on top of containers
            switch (terrain.get(x, y)) {
              // No action cases
              case TERRAIN_MASK_WALL:
                break
              // Build road cases
              case 0: // plain
              case TERRAIN_MASK_SWAMP:
              default:
                if (
                  constructionSitesPlannedThisTick <
                    MAX_CONSTRUCTION_SITES_PER_TICK &&
                  buildRoads &&
                  Game.spawns.Spawn1.room.createConstructionSite(
                    x,
                    y,
                    STRUCTURE_ROAD
                  ) === OK
                ) {
                  constructionSitesPlannedThisTick++
                }
                break
            }
          }
        }
      }
    }

    // Road planning logic part 4: Build roads between each mineable position in the Spawn's room
    // Plan all roads in the previous loops before building roads between mineable positions
    for (const mineablePosition of mineablePositions) {
      // TODO: Build roads between mineable positions in other rooms
      for (const mineablePositionTwo of mineablePositions) {
        // TODO: Only build roads between mineable positions that are close to each other, like for the same source, like range < 5
        const pathToMineablePositionTwo = mineablePosition.findPathTo(
          mineablePositionTwo,
          {
            ignoreCreeps: true, // don't ignore creeps when pathing between mineable positions -- this should help traffic flow
            //swampCost: 1, // ignore swamps; we want to build on swamps
            // maxRooms: 1, // don't path through other rooms
          }
        )
        for (const [index, pathStep] of pathToMineablePositionTwo.entries()) {
          if (index > 0 && index < pathToMineablePositionTwo.length - 1) {
            // Here's the reason it's index > 0 and index < pathToMineablePositionTwo.length - 1:
            // Don't build roads on mineable positions,
            // since miners sit there on top of containers
            if (
              constructionSitesPlannedThisTick <
                MAX_CONSTRUCTION_SITES_PER_TICK &&
              buildRoads &&
              Game.spawns.Spawn1.room.createConstructionSite(
                pathStep.x,
                pathStep.y,
                STRUCTURE_ROAD
              ) === OK
            ) {
              constructionSitesPlannedThisTick++
            }
          }
        }
      }
    }

    // Road planning logic part 5: Plan roads from every mineable position to the room's controller (for upgraders)
    for (const mineablePosition of mineablePositions) {
      const controller = Game.spawns.Spawn1.room.controller
      if (controller) {
        const pathToController = mineablePosition.findPathTo(controller, {
          ignoreCreeps: true, // maybe should be true for road planning,
          // maxRooms: 1,
        })
        for (const [index, pathStep] of pathToController.entries()) {
          if (index > 0 && index < pathToController.length - 4) {
            // Here's the reason it's index > 0 and index < pathToMineablePositionTwo.length - 1:
            // Don't build roads on mineable positions,
            // since miners sit there on top of containers AND
            // Don't build construction sites within 3 range of controller
            // because the upgradeController command has 3 squares range
            if (
              constructionSitesPlannedThisTick <
                MAX_CONSTRUCTION_SITES_PER_TICK &&
              buildRoads &&
              Game.spawns.Spawn1.room.createConstructionSite(
                pathStep.x,
                pathStep.y,
                STRUCTURE_ROAD
              ) === OK
            ) {
              constructionSitesPlannedThisTick++
            }
          }
        }
      }
    }

    // Helper for road planning 6 & 7
    const planRoadsInTargetRooms = (targetRooms: Room[]) => {
      // Loop through the accessible rooms & plan roads to mineable positions
      for (const targetRoom of targetRooms) {
        // Find the mineable positions we want to build roads to
        const mineablePositionsAdjacentRoom = getMineablePositions(targetRoom)
        // Create a terrain helper for quick lookups of terrain
        const terrainAdjacentRoom = new Room.Terrain(targetRoom.name)
        // Count the containers because there's a maximum of 5 containers allowed
        let containersCount = targetRoom.find(FIND_STRUCTURES, {
          filter: (structure) => structure.structureType === "container",
        }).length
        containersCount += targetRoom.find(FIND_CONSTRUCTION_SITES, {
          filter: (constructionSite) =>
            constructionSite.structureType === "container",
        }).length

        // Plan containers at each mineable position as well as
        // roads to and around each mineable position
        for (const mineablePosition of mineablePositionsAdjacentRoom) {
          if (containersCount < MAX_CONTAINERS) {
            if (
              constructionSitesPlannedThisTick <
                MAX_CONSTRUCTION_SITES_PER_TICK &&
              targetRoom.createConstructionSite(
                mineablePosition.x,
                mineablePosition.y,
                STRUCTURE_CONTAINER
              ) === OK
            ) {
              containersCount++
              constructionSitesPlannedThisTick++
            }
          }
          // Build roads from the creep Spawn to each exit (mineable position)
          const pathFromSpawnToMineablePosition = Game.spawns.Spawn1.pos.findPathTo(
            mineablePosition,
            {
              ignoreCreeps: true, // maybe should be true for road planning,
              // maxRooms: 1, // Only plan roads in the Spawn's room on this loop
            }
          )
          for (const [
            index,
            pathStep,
          ] of pathFromSpawnToMineablePosition.entries()) {
            if (
              index > 0 &&
              index < pathFromSpawnToMineablePosition.length - 1
            ) {
              pathStep
              // Here's the reason it's index > 0 and index < pathToMineablePosition.length - 1:
              // Don't build roads on top of Spawns AND
              // Don't build roads on top of exit squares
              if (
                constructionSitesPlannedThisTick <
                  MAX_CONSTRUCTION_SITES_PER_TICK &&
                buildRoads &&
                Game.spawns.Spawn1.room.createConstructionSite(
                  pathStep.x,
                  pathStep.y,
                  STRUCTURE_ROAD
                ) === OK
              ) {
                constructionSitesPlannedThisTick++
              }
            }
          }

          // Build roads from each mineable position back to the creep Spawn
          const pathFromMineablePositionToSpawn = mineablePosition.findPathTo(
            Game.spawns.Spawn1.pos,
            {
              ignoreCreeps: true, // maybe should be true for road planning,
              // maxRooms: 1, // Search in the source's room, not the Spawn's room
            }
          )
          for (const [
            index,
            pathStep,
          ] of pathFromMineablePositionToSpawn.entries()) {
            if (
              index > 0 &&
              index < pathFromMineablePositionToSpawn.length - 1
            ) {
              pathStep
              // Here's the reason it's index > 0 and index < pathToMineablePosition.length - 1:
              // Don't build roads on top of mineable positions AND
              // Don't build roads on top of exit squares
              if (
                constructionSitesPlannedThisTick <
                  MAX_CONSTRUCTION_SITES_PER_TICK &&
                buildRoads &&
                targetRoom.createConstructionSite(
                  pathStep.x,
                  pathStep.y,
                  STRUCTURE_ROAD
                ) === OK
              ) {
                constructionSitesPlannedThisTick++
              }
            }
          }

          // Build roads surrounding each mineablePosition
          for (
            let x = mineablePosition.x - 1;
            x <= mineablePosition.x + 1;
            x++
          ) {
            for (
              let y = mineablePosition.y - 1;
              y <= mineablePosition.y + 1;
              y++
            ) {
              if (x !== mineablePosition.x && y !== mineablePosition.y) {
                // Don't build roads on mineable positions,
                // since miners sit there on top of containers
                switch (terrainAdjacentRoom.get(x, y)) {
                  // No action cases
                  case TERRAIN_MASK_WALL:
                    break
                  // Build road cases
                  case 0: // plain
                  case TERRAIN_MASK_SWAMP:
                  default:
                    if (
                      constructionSitesPlannedThisTick <
                        MAX_CONSTRUCTION_SITES_PER_TICK &&
                      buildRoads &&
                      targetRoom.createConstructionSite(
                        x,
                        y,
                        STRUCTURE_ROAD
                      ) === OK
                    ) {
                      constructionSitesPlannedThisTick++
                    }
                    break
                }
              }
            }
          }
        }
      }
    }

    // Road planning logic part 6: Energy sources in accessible adjacent rooms
    planRoadsInTargetRooms(accessibleAdjacentRoomsWithVision)

    // Road planning logic part 7: Energy sources in all rooms
    planRoadsInTargetRooms(Object.values(Game.rooms))
    // End of road planning logic
  }
}
