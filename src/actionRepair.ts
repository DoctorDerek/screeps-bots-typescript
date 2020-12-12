// Seek and repair lowest HP structure
export const actionRepair = (creep: Creep) => {
  let targetRepairSite
  const allRepairSites: Structure[] = []
  // Look for the repair site with the lowest HP
  for (const room of Object.values(Game.rooms)) {
    // We use FIND_STRUCTURES and not FIND_MY_STRUCTURES
    // because containers and roads aren't owned structures
    allRepairSites.push(...room.find(FIND_STRUCTURES))
  }
  // Percentage-based sort:
  allRepairSites.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax)
  // Absolute HP to repair-based sort
  // allRepairSites.sort((a, b) => a.hitsMax - a.hits - (b.hitsMax - b.hits))
  targetRepairSite = allRepairSites[0]

  if (targetRepairSite) {
    creep.say("🔧REPAIR🔧")
    // There is a repair site somewhere for us to work on
    const repairResult = creep.repair(targetRepairSite)
    switch (repairResult) {
      // Move to the lowest HP repair site
      case ERR_NOT_IN_RANGE: // The target is too far away.
        creep.moveTo(targetRepairSite, {
          visualizePathStyle: { stroke: "#ffffff" },
        })
        break

      // Do nothing cases
      case OK: // The operation has been scheduled successfully.
        break

      // Unhandled cases
      case ERR_NOT_OWNER: // You are not the owner of this creep.
      case ERR_BUSY: // The creep is still being spawned.
      case ERR_NOT_ENOUGH_RESOURCES: // The creep does not have any carried energy.
      case ERR_INVALID_TARGET: // The target is not a valid Repair site object or the structure cannot be built here (probably because of a creep at the same square).
      case ERR_NO_BODYPART: // There are no WORK body parts in this creep’s body.
      default:
        console.log(
          `Unexpected error in build routine: ${repairResult} by ${creep.name}`
        )
    }
  } else {
    console.log(`${creep.name} had no repair site anywhere`)
    // STATE TRANSITION: REPAIR --> BUILD
    creep.memory.state = "BUILD"
  }
}
