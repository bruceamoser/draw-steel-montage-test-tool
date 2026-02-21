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
    failureOutcome: options.failureOutcome ?? "",
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
    characteristic: options.characteristic ?? null,
    skill: options.skill ?? null,
    difficulty: options.difficulty ?? null,
    rollTotal: options.rollTotal ?? null,
    naturalRoll: options.naturalRoll ?? null,
    tier: options.tier ?? null,
    outcome: options.outcome ?? null,
    isSuccess: options.isSuccess ?? null,
    abilityName: options.abilityName ?? null,
    aidTarget: options.aidTarget ?? null,
    aidResult: options.aidResult ?? null,
    autoSuccesses: options.autoSuccesses ?? 0,
    approved: options.approved ?? false,
    resolved: options.resolved ?? false,
    gmNotes: options.gmNotes ?? "",
  };
}

/**
 * Save the active montage test to world settings.
 * @param {object} testData
 */
export async function saveActiveTest(testData) {
  await game.settings.set(MODULE_ID, FLAGS.ACTIVE_TEST, testData);
}

/**
 * Load the active montage test from world settings.
 * @returns {object|null}
 */
export function loadActiveTest() {
  return game.settings.get(MODULE_ID, FLAGS.ACTIVE_TEST) ?? null;
}

/**
 * Clear the active montage test from world settings.
 */
export async function clearActiveTest() {
  await game.settings.set(MODULE_ID, FLAGS.ACTIVE_TEST, null);
}

/**
 * Archive a completed test to the completed tests list.
 * @param {object} testData
 */
export async function archiveTest(testData) {
  const completed = game.settings.get(MODULE_ID, FLAGS.COMPLETED_TESTS) ?? [];
  completed.push({
    ...testData,
    completedAt: Date.now(),
  });
  await game.settings.set(MODULE_ID, FLAGS.COMPLETED_TESTS, completed);
}

/* ================================================ */
/*  Draft (saved) montage test CRUD                 */
/* ================================================ */

/**
 * Load all saved draft montage tests.
 * @returns {Array<object>}
 */
export function loadDraftTests() {
  return game.settings.get(MODULE_ID, FLAGS.SAVED_TESTS) ?? [];
}

/**
 * Get a single draft test by ID.
 * @param {string} testId
 * @returns {object|null}
 */
export function getDraftTest(testId) {
  const drafts = loadDraftTests();
  return drafts.find((t) => t.id === testId) ?? null;
}

/**
 * Save a new draft test to the saved tests array.
 * @param {object} testData
 */
export async function saveDraftTest(testData) {
  const drafts = loadDraftTests();
  drafts.push(testData);
  await game.settings.set(MODULE_ID, FLAGS.SAVED_TESTS, drafts);
}

/**
 * Update an existing draft test in the saved tests array.
 * @param {object} testData
 */
export async function updateDraftTest(testData) {
  const drafts = loadDraftTests();
  const idx = drafts.findIndex((t) => t.id === testData.id);
  if (idx >= 0) {
    drafts[idx] = testData;
    await game.settings.set(MODULE_ID, FLAGS.SAVED_TESTS, drafts);
  }
}

/**
 * Delete a draft test from the saved tests array.
 * @param {string} testId
 */
export async function deleteDraftTest(testId) {
  const drafts = loadDraftTests();
  const filtered = drafts.filter((t) => t.id !== testId);
  await game.settings.set(MODULE_ID, FLAGS.SAVED_TESTS, filtered);
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
