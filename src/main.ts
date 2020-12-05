import { ErrorMapper } from "utils/ErrorMapper"
import { roleMiner } from "roleMiner"
import { roleFetcher } from "roleFetcher"
import { roleUpgrader } from "roleUpgrader"
import { roleDefender } from "roleDefender"
import { roleBuilder } from "roleBuilder"
import { roleEye } from "roleEye"
import {
  getAccessibleAdjacentRoomNames,
  getRoomsFromRoomNamesIfVision,
  getAccessibleRoomNamesWithVision,
  getAccessibleRoomNamesWithoutVision,
  getMineablePositionsInAllRoomsWithVision,
  getMineablePositions,
  getCreepTemplatesAndTargetCounts,
  planRoads,
} from "helper_functions"
import { roleTaxi } from "roleTaxi"

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`)

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name]
      console.log("Clearing non-existing creep memory:", name)
    }
  }

  planRoads()

  // Constants and initializations
  // Define roles
  const creepRoles = [
    "MiniFetcher",
    "Miner",
    "Fetcher",
    "Upgrader",
    "Builder",
    "Defender",
    "Eye",
    "Taxi",
  ]
  const creepTemplates: { [role: string]: BodyPartConstant[] } = {
    MiniFetcher: [MOVE, CARRY], // 100
    // Miner: [WORK, WORK, MOVE], // 250
    // Miner: [WORK, WORK, WORK], // 300
    Miner: [WORK], // 100 // TODO increase WORK parts
    Fetcher: [MOVE, CARRY, CARRY, CARRY, CARRY], // 250
    Upgrader: [WORK, MOVE, CARRY, CARRY, CARRY], // 300
    Builder: [WORK, MOVE, CARRY, CARRY, CARRY], // 300
    Defender: [MOVE, MOVE, ATTACK, ATTACK], // 260
    Eye: [MOVE], // 50
    Taxi: [MOVE, CARRY], // 100 // TODO increase MOVE parts
  }
  const creepCounts: { [role: string]: number } = {}
  for (const role of creepRoles) {
    creepCounts[role] = _.filter(
      Game.creeps,
      (creep) => creep.memory.role === role
    ).length
  }

  // Generate some creeps
  // TODO: Smarter energy check (300)
  // WIP: Check every 10 turns
  const SPAWN_A_CREEP_EVERY_X_TURNS = 10
  if (
    Game.spawns.Spawn1.spawning === null &&
    (Game.spawns.Spawn1.room.energyAvailable >= 0 ||
      (Game.time % SPAWN_A_CREEP_EVERY_X_TURNS === 0 &&
        Game.spawns.Spawn1.room.energyAvailable >= 100))
  ) {
    // Count mineable positions in all rooms with vision
    let mineablePositionsCount = getMineablePositionsInAllRoomsWithVision()
      .length

    // First, count the construction sites in this & surrounding rooms
    let constructionSiteCount = Game.spawns.Spawn1.room.find(
      FIND_CONSTRUCTION_SITES // not FIND_MY_CONSTRUCTION_SITES
    ).length
    // FIND_MY_CONSTRUCTION_SITES won't work on roads (neutral structures)
    // Find the rooms accessible from this one (this room exits there)
    const accessibleAdjacentRoomsWithVision: Array<Room> = getRoomsFromRoomNamesIfVision(
      getAccessibleAdjacentRoomNames(Game.spawns.Spawn1.room)
    )
    // Add the under-construction roads and containers in adjacent rooms
    for (const accessibleAdjacentRoom of accessibleAdjacentRoomsWithVision) {
      constructionSiteCount += accessibleAdjacentRoom.find(
        FIND_CONSTRUCTION_SITES // not FIND_MY_CONSTRUCTION_SITES
      ).length
    }

    // Log current counts to console
    for (const role of creepRoles) {
      const outputMessage = `${role}s: ${creepCounts[role]}`
      if (role === "Miner") {
        console.log(
          `${outputMessage} of ${mineablePositionsCount} mineable positions`
        )
      } else {
        console.log(outputMessage)
      }
    }

    // Helper Functions
    const generateCreepName = (role: string) => {
      let randomNumber: number
      let name: string
      do {
        randomNumber = Math.floor(Math.random() * 100)
        name = `${role}_${randomNumber}`
      } while (_.filter(Game.creeps, (creep) => creep.name === name).length > 0)
      // Return a unique name for this creep
      return name
    }
    const spawnCreep = (role: string) => {
      const creepName = generateCreepName(role)
      console.log(`Spawning new creep: ${creepName}`)
      return Game.spawns.Spawn1.spawnCreep(creepTemplates[role], creepName, {
        memory: {
          role,
          state: "THINK",
          destination: new RoomPosition(0, 0, Game.spawns.Spawn1.room.name),
          taxiDriver: "",
        },
      })
    }

    // Spawn a creep
    // Spawn creeps on a "per-room" basis, 5 at a time
    const visibleRooms = Array.from(Object.values(Game.rooms))
    const roomCount = visibleRooms.length
    let creepsPerRoom = 0
    let spawnResult // we set this when we actually attempt a spawn
    /*while (creepsPerRoom < mineablePositionsCount) {
      if (spawnResult === OK || spawnResult === ERR_NOT_ENOUGH_ENERGY) {
        break
      }*/
    {
      if (spawnResult !== undefined) {
        console.log(`Game.spawns.Spawn1 had spawn result ${spawnResult}`)
      }
      creepsPerRoom += mineablePositionsCount / roomCount
      // This is the average mineablePositions from rooms that we have vision in

      // start TAXI testing
      // TODO: initial Taxi / Miner (1st miner vs. 2nd miners)
      // Taxi: MOVE -> MOVE / CARRY
      // Miner: WORK WORK -> WORK / WORK / WORK
      if (
        creepCounts.Taxi < creepCounts.Miner ||
        creepCounts.Miner >= mineablePositionsCount
      ) {
        // Brand new room, spawn mini creeps instead
        spawnResult = spawnCreep("Taxi")
      } else {
        // Always spawn an Upgrader when we have at least one Miner
        spawnResult = spawnCreep("Miner")
      }
      // end TAXI testing
      /*
      if (
        creepCounts.MiniFetcher < creepCounts.Miner &&
        creepCounts.MiniFetcher < creepsPerRoom
      ) {
        // Brand new room, spawn mini creeps instead
        spawnResult = spawnCreep("MiniFetcher")
      } else if (creepCounts.Upgrader < 1 && creepCounts.Miner > 0) {
        // Always spawn an Upgrader when we have at least one Miner
        spawnResult = spawnCreep("Upgrader")
      }
      else if (
        creepCounts.Miner < creepsPerRoom * 2 &&
        creepCounts.Miner < mineablePositionsCount
      ) {
        // spawn twice as many miners as we should per-room
        // until we hit mineable positions (the max miners)
        spawnResult = spawnCreep("Miner")
      } else if (creepCounts.Eye < creepsPerRoom) {
        spawnResult = spawnCreep("Eye")
      } else if (creepCounts.Upgrader < creepsPerRoom) {
        spawnResult = spawnCreep("Upgrader")
      } else if (
        creepCounts.Builder < creepsPerRoom &&
        constructionSiteCount > 0
      ) {
        spawnResult = spawnCreep("Builder")
      } else if (creepCounts.Fetcher < creepsPerRoom) {
        // normal size fetchers hopefully once roads are being built
        spawnResult = spawnCreep("Fetcher")
      } else if (creepCounts.Defender < creepsPerRoom) {
        spawnResult = spawnCreep("Defender")
      }
      // TODO: Defense against creep invasion
      // else if (creepCounts.Defender < 3) {      spawnCreep("Defender")    }
      */
    }
    console.log(
      `🧠 creepsPerRoom is ${Math.ceil(
        creepsPerRoom
      )} of ${mineablePositionsCount} mineable positions in ${
        Array.from(Object.entries(Game.rooms)).length
      } visible rooms`
    )
  }

  // Run all creeps
  for (const creepName in Game.creeps) {
    const creep = Game.creeps[creepName]
    const creepRole = creep.memory.role
    try {
      if (creep.spawning === false) {
        switch (creepRole) {
          case "Miner":
            roleMiner.run(creep)
            break
          case "Fetcher":
          // no break
          case "MiniFetcher":
            roleFetcher.run(creep)
            break
          case "Upgrader":
            roleUpgrader.run(creep)
            break
          case "Builder":
            roleBuilder.run(creep)
            break
          case "Defender":
            roleDefender.run(creep)
            break
          case "Eye":
            roleEye.run(creep)
            break
          case "Taxi":
            roleTaxi.run(creep)
            break
          default:
            console.log(`Unknown creep role: ${creep.memory.role}`)
            break
        }
      }
    } catch (e) {
      console.log(`${creepName} of role ${creepRole} threw a ${e}`)
    }
  }
})
