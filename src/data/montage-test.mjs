import { MODULE_ID, FLAGS, TEST_STATUS, DEFAULT_MAX_ROUNDS, ACTION_TYPE } from "../config.mjs";
import { calculateLimits } from "../helpers/difficulty.mjs";

/**
 * Create a blank montage test data structure.
 * @param {object} options
 * @param {string} options.name
 * @param {string} options.difficulty - "easy" | "moderate" | "hard"
 * @param {number} options.heroCount
 * @param {Array<{actorId: string, name: string, img: string}>} options.heroes
 * @param {number} [options.maxRounds]
 * @param {number} [options.successLimit] - Override calculated value
 * @param {number} [options.failureLimit] - Override calculated value
 * @returns {object}
 */
export function createMontageTestData(options) {
  const limits = calculateLimits(options.difficulty, options.heroCount);

  return {
    id: foundry.utils.randomID(),
    name: options.name || "Montage Test",
    difficulty: options.difficulty,
    heroCount: options.heroCount,
    successLimit: options.successLimit ?? limits.successLimit,
    failureLimit: options.failureLimit ?? limits.failureLimit,
    currentSuccesses: 0,
    currentFailures: 0,
    currentRound: 1,
    maxRounds: options.maxRounds ?? DEFAULT_MAX_ROUNDS,
    status: TEST_STATUS.SETUP,
    outcome: null,
    victories: 0,
    heroes: options.heroes ?? [],
    complications: options.complications ?? [],
    rounds: [],
    gmNotes: {
      totalSuccess: options.gmNotes?.totalSuccess ?? "",
      partialSuccess: options.gmNotes?.partialSuccess ?? "",
      totalFailure: options.gmNotes?.totalFailure ?? "",
      general: options.gmNotes?.general ?? "",
    },
    pendingActions: [],
  };
}

/**
 * Create a blank complication entry.
 * @param {object} [options]
 * @returns {object}
 */
export function createComplication(options = {}) {
  return {
    id: foundry.utils.randomID(),
    description: options.description ?? "",
    triggerRound: options.triggerRound ?? 1,
    resolved: false,
    effect: options.effect ?? "",
  };
}

/**
 * Create a new round data structure.
 * @param {number} roundNumber
 * @returns {object}
 */
export function createRoundData(roundNumber) {
  return {
    roundNumber,
    actions: [],
  };
}

/**
 * Create a hero action data structure.
 * @param {object} options
 * @returns {object}
 */
export function createActionData(options) {
  return {
    actorId: options.actorId,
    type: options.type ?? ACTION_TYPE.NOTHING,
    description: options.description ?? "",
    difficulty: options.difficulty ?? null,
    rollTotal: options.rollTotal ?? null,
    naturalRoll: options.naturalRoll ?? null,
    tier: options.tier ?? null,
    outcome: options.outcome ?? null,
    isSuccess: options.isSuccess ?? null,
    aidTarget: options.aidTarget ?? null,
    aidResult: options.aidResult ?? null,
    autoSuccesses: options.autoSuccesses ?? 0,
    approved: options.approved ?? false,
    resolved: options.resolved ?? false,
    gmNotes: options.gmNotes ?? "",
  };
}

/**
 * Save the active montage test to world flags.
 * @param {object} testData
 */
export async function saveActiveTest(testData) {
  await game.world.setFlag(MODULE_ID, FLAGS.ACTIVE_TEST, testData);
}

/**
 * Load the active montage test from world flags.
 * @returns {object|null}
 */
export function loadActiveTest() {
  return game.world.getFlag(MODULE_ID, FLAGS.ACTIVE_TEST) ?? null;
}

/**
 * Clear the active montage test from world flags.
 */
export async function clearActiveTest() {
  await game.world.unsetFlag(MODULE_ID, FLAGS.ACTIVE_TEST);
}

/**
 * Archive a completed test to the completed tests list.
 * @param {object} testData
 */
export async function archiveTest(testData) {
  const completed = game.world.getFlag(MODULE_ID, FLAGS.COMPLETED_TESTS) ?? [];
  completed.push({
    ...testData,
    completedAt: Date.now(),
  });
  await game.world.setFlag(MODULE_ID, FLAGS.COMPLETED_TESTS, completed);
}

/**
 * Get active hero actors from the game world.
 * Returns all player-owned hero actors.
 * @returns {Array<{actorId: string, name: string, img: string}>}
 */
export function getAvailableHeroes() {
  return game.actors
    .filter((a) => a.type === "hero" && a.hasPlayerOwner)
    .map((a) => ({
      actorId: a.id,
      name: a.name,
      img: a.img ?? "icons/svg/mystery-man.svg",
    }));
}
