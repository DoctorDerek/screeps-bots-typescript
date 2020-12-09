import { lookForAtAreaWithOffset } from "helper_functions"

export const actionRepairNearby = (creep: Creep) => {
  // Repair the structure around us with the lowest HP
  const REPAIR_OFFSET = 3 // we can repair in a 3 range around us
  const nearbyStructures = lookForAtAreaWithOffset(
    creep,
    REPAIR_OFFSET,
    LOOK_STRUCTURES
  ).filter((result) => result.structure.hits < result.structure.hitsMax)
  if (nearbyStructures.length > 0) {
    nearbyStructures.sort((a, b) => a.structure.hits - b.structure.hits)
    const repairResult = creep.repair(nearbyStructures[0].structure)
    if (repairResult !== OK) {
      console.log(`${creep.name} had repair error: ${repairResult}`)
    }
    creep.say("🔧Repair🔧")
  }
}
