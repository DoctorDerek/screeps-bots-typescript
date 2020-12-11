import { ErrorMapper } from "utils/ErrorMapper"
import { roleMiner } from "roleMiner"
import { roleTaxi } from "roleTaxi"
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
import { roleClaim } from "roleClaim"

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
  const creepTemplates: { [role: string]: BodyPartConstant[] } = {
    // Miner: [WORK, WORK, MOVE], // 250 (Old - No Taxi)
    Miner: [WORK, WORK, WORK], // 300
    Taxi: [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY], // 300
    // Mini creeps for brand new room
    MiniMiner: [WORK, WORK], // 200
    MiniTaxi: [MOVE, CARRY], // 100
    Upgrader: [WORK, MOVE, CARRY, CARRY, CARRY], // 300
    Builder: [WORK, MOVE, CARRY, CARRY, CARRY], // 300
    Defender: [MOVE, MOVE, ATTACK, ATTACK], // 260
    Eye: [MOVE], // 50
    Claim: [MOVE, CLAIM], // 650
  }
  const creepRoles = Array.from(Object.keys(creepTemplates))
  const getCost = (role: string) =>
    creepTemplates[role].reduce((sum, part) => sum + BODYPART_COST[part], 0)
  const creepCosts: { [role: string]: number } = {}
  let minimumCost = Infinity
  creepRoles.forEach((role) => {
    const cost = getCost(role)
    creepCosts[role] = cost
    if (cost < minimumCost) {
      minimumCost = cost
    }
  })
  const creepCounts: { [role: string]: number } = {}
  for (const role of creepRoles) {
    creepCounts[role] = _.filter(
      Game.creeps,
      (creep) => creep.memory.role === role
    ).length
  }
  const DEBUG = false
  DEBUG &&
    Array.from(Object.entries(creepCosts)).forEach(([role, cost]) =>
      console.log(`${role}: ${cost}`)
    )

  const energyAvailable = Game.spawns.Spawn1.room.energyAvailable
  // Generate some creeps
  // TODO : Smarter cost detection
  minimumCost = 300
  if (
    Game.spawns.Spawn1.spawning === null &&
    (creepCounts.Miner === 0 ||
      creepCounts.Taxi === 0 ||
      energyAvailable >= minimumCost)
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
    const roomsWithoutSpawns = roomCount - 1
    let creepsPerRoom = 0
    let spawnResult // we set this when we actually attempt a spawn
    while (creepsPerRoom < mineablePositionsCount) {
      if (spawnResult === OK || spawnResult === ERR_NOT_ENOUGH_ENERGY) {
        break
      }
      {
        if (spawnResult !== undefined) {
          console.log(`Game.spawns.Spawn1 had spawn result ${spawnResult}`)
        }
        creepsPerRoom += 1
        creepsPerRoom += mineablePositionsCount / roomCount
        // This is the average mineablePositions from rooms that we have vision in

        if (
          Game.spawns.Spawn1.room.find(FIND_HOSTILE_CREEPS).length > 0 &&
          creepCosts.Defender <= energyAvailable
        ) {
          spawnResult = spawnCreep("Defender")
        } else {
          creepCounts.Miner += creepCounts.MiniMiner
          creepCounts.Taxi += creepCounts.MiniTaxi
          if (
            creepCounts.Miner === 0 &&
            creepCosts.MiniMiner <= energyAvailable
          ) {
            // Brand new room, spawn mini creeps instead
            spawnResult = spawnCreep("MiniMiner")
          } else if (
            creepCounts.Taxi === 0 &&
            creepCosts.MiniTaxi <= energyAvailable
          ) {
            // Spawn a MiniTaxi to match our MiniMiner
            spawnResult = spawnCreep("MiniTaxi")
          } else if (
            creepCounts.Upgrader < 1 &&
            creepCounts.Miner >= 2 &&
            creepCosts.Upgrader <= energyAvailable
          ) {
            // Always spawn an Upgrader when we have at least two Miners
            spawnResult = spawnCreep("Upgrader")
          } else if (
            creepCounts.Taxi < creepCounts.Miner &&
            creepCosts.Taxi <= energyAvailable
          ) {
            spawnResult = spawnCreep("Taxi")
          } else if (
            creepCounts.Miner < creepsPerRoom * 2 &&
            creepCounts.Miner < mineablePositionsCount &&
            creepCosts.Miner <= energyAvailable
          ) {
            // Spawn twice as many miners as we should per-room
            // until we hit mineable positions (the max miners)
            spawnResult = spawnCreep("Miner")
          } else if (
            creepCounts.Taxi < creepsPerRoom &&
            creepCosts.Taxi <= energyAvailable
          ) {
            spawnResult = spawnCreep("Taxi")
          } else if (
            creepCounts.Claim < creepsPerRoom &&
            creepCounts.Claim < roomsWithoutSpawns &&
            creepCosts.Claim <= energyAvailable
          ) {
            // We need a claim creep for every room without a spawn
          } else if (
            creepCounts.Upgrader < creepsPerRoom / 2 &&
            creepCosts.Upgrader <= energyAvailable
          ) {
            spawnResult = spawnCreep("Upgrader")
          } else if (
            creepCounts.Builder < creepsPerRoom / 2 &&
            constructionSiteCount > 0 &&
            creepCosts.Builder <= energyAvailable
          ) {
            spawnResult = spawnCreep("Builder")
          } else if (
            creepCounts.Eye < creepsPerRoom / 2 &&
            creepCosts.Eye <= energyAvailable
          ) {
            spawnResult = spawnCreep("Eye")
          } else if (
            creepCounts.Defender < creepsPerRoom &&
            creepCosts.Defender <= energyAvailable
          ) {
            spawnResult = spawnCreep("Defender")
          }
        }
      }
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
          // no break
          case "MiniMiner":
            roleMiner.run(creep)
            break
          case "Taxi":
          // no break
          case "MiniTaxi":
            roleTaxi.run(creep)
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
          case "Claim":
            roleClaim.run(creep)
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
