import {
  DIFFICULTY_TABLE_BASE,
  BASE_HERO_COUNT,
  MIN_LIMIT,
  DEFAULT_MAX_ROUNDS,
  TIER_BOUNDARIES,
  TEST_OUTCOMES,
  ASSIST_OUTCOMES,
} from "../config.mjs";

/**
 * Calculate the success and failure limits for a montage test.
 * @param {string} difficulty - "easy" | "moderate" | "hard"
 * @param {number} heroCount - Number of participating heroes
 * @returns {{ successLimit: number, failureLimit: number }}
 */
export function calculateLimits(difficulty, heroCount) {
  const base = DIFFICULTY_TABLE_BASE[difficulty];
  if (!base) throw new Error(`Unknown montage difficulty: ${difficulty}`);

  const delta = heroCount - BASE_HERO_COUNT;
  return {
    successLimit: Math.max(MIN_LIMIT, base.successLimit + delta),
    failureLimit: Math.max(MIN_LIMIT, base.failureLimit + delta),
  };
}

/**
 * Determine the power roll tier from a numeric total.
 * @param {number} total - The power roll total (2d10 + characteristic + modifiers)
 * @returns {1|2|3}
 */
export function getTier(total) {
  if (total <= TIER_BOUNDARIES.TIER_1_MAX) return 1;
  if (total <= TIER_BOUNDARIES.TIER_2_MAX) return 2;
  return 3;
}

/**
 * Determine the outcome of an individual test within a montage.
 * @param {string} testDifficulty - "easy" | "medium" | "hard"
 * @param {number} tier - 1, 2, or 3
 * @param {boolean} [isNatural19or20=false] - Whether the natural roll was 19 or 20
 * @returns {{ key: string, label: string, isSuccess: boolean }}
 */
export function getTestOutcome(testDifficulty, tier, isNatural19or20 = false) {
  // Natural 19/20 always counts as Tier 3 success with reward
  if (isNatural19or20) {
    return {
      key: "successReward",
      label: "MONTAGE.Outcome.SuccessReward",
      isSuccess: true,
    };
  }
  const outcomes = TEST_OUTCOMES[testDifficulty];
  if (!outcomes) throw new Error(`Unknown test difficulty: ${testDifficulty}`);
  return outcomes[tier];
}

/**
 * Determine the outcome of an assist roll.
 * @param {number} tier - 1, 2, or 3
 * @returns {{ key: string, label: string }}
 */
export function getAssistOutcome(tier) {
  return ASSIST_OUTCOMES[tier];
}

/**
 * Get the default number of montage test rounds.
 * @returns {number}
 */
export function getDefaultMaxRounds() {
  return DEFAULT_MAX_ROUNDS;
}

/**
 * Get a summary string for difficulty limits.
 * @param {string} difficulty
 * @param {number} heroCount
 * @returns {string}
 */
export function getDifficultySummary(difficulty, heroCount) {
  const { successLimit, failureLimit } = calculateLimits(difficulty, heroCount);
  return `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}: ${successLimit} successes needed, ${failureLimit} failures allowed`;
}
