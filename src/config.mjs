/**
 * Module constants and configuration for Draw Steel Montage Test Tool
 */
export const MODULE_ID = "draw-steel-montage";
export const SYSTEM_ID = "draw-steel";

export const SOCKET_NAME = `module.${MODULE_ID}`;

export const FLAGS = {
  ACTIVE_TEST: "activeTest",
  COMPLETED_TESTS: "completedTests",
  SAVED_TESTS: "savedTests",
};

/**
 * Montage test status lifecycle
 */
export const TEST_STATUS = {
  SETUP: "setup",
  ACTIVE: "active",
  RESOLVED: "resolved",
};

/**
 * Montage test difficulty levels
 */
export const MONTAGE_DIFFICULTY = {
  EASY: "easy",
  MODERATE: "moderate",
  HARD: "hard",
};

/**
 * Individual test difficulty levels (set per-action by the GM)
 */
export const TEST_DIFFICULTY = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
};

/**
 * Hero action types within a montage round
 */
export const ACTION_TYPE = {
  ROLL: "roll",
  AID: "aid",
  ABILITY: "ability",
  NOTHING: "nothing",
};

/**
 * Possible outcomes for the overall montage test
 */
export const MONTAGE_OUTCOME = {
  TOTAL_SUCCESS: "totalSuccess",
  PARTIAL_SUCCESS: "partialSuccess",
  TOTAL_FAILURE: "totalFailure",
};

/**
 * Characteristic labels — hardcoded to avoid dependency on Draw Steel system i18n structure.
 */
export const CHARACTERISTIC_LABELS = {
  might: "Might",
  agility: "Agility",
  reason: "Reason",
  intuition: "Intuition",
  presence: "Presence",
};

/**
 * Look up a skill label from the Draw Steel system's translations.
 * Falls back to the raw key if the system translations aren't available.
 * @param {string} key - The skill key (e.g. "Culture", "Climb")
 * @returns {string}
 */
export function getSkillLabel(key) {
  return game.i18n.translations?.DRAW_STEEL?.SKILL?.List?.[key] ?? key;
}

/**
 * Power roll tier boundaries (2d10 + characteristic)
 * Tier 1: ≤ 11
 * Tier 2: 12–16
 * Tier 3: 17+
 */
export const TIER_BOUNDARIES = {
  TIER_1_MAX: 11,
  TIER_2_MAX: 16,
};

/**
 * Individual test outcomes mapped by [difficulty][tier]
 * Each entry: { label, isSuccess }
 *
 * From Draw Steel rules:
 *   Easy:   T1 = success w/ consequence, T2 = success, T3 = success w/ reward
 *   Medium: T1 = failure,                T2 = success w/ consequence, T3 = success
 *   Hard:   T1 = failure w/ consequence,  T2 = failure, T3 = success
 */
export const TEST_OUTCOMES = {
  easy: {
    1: { key: "successConsequence", label: "MONTAGE.Outcome.SuccessConsequence", isSuccess: true },
    2: { key: "success", label: "MONTAGE.Outcome.Success", isSuccess: true },
    3: { key: "successReward", label: "MONTAGE.Outcome.SuccessReward", isSuccess: true },
  },
  medium: {
    1: { key: "failure", label: "MONTAGE.Outcome.Failure", isSuccess: false },
    2: { key: "successConsequence", label: "MONTAGE.Outcome.SuccessConsequence", isSuccess: true },
    3: { key: "success", label: "MONTAGE.Outcome.Success", isSuccess: true },
  },
  hard: {
    1: { key: "failureConsequence", label: "MONTAGE.Outcome.FailureConsequence", isSuccess: false },
    2: { key: "failure", label: "MONTAGE.Outcome.Failure", isSuccess: false },
    3: { key: "success", label: "MONTAGE.Outcome.Success", isSuccess: true },
  },
};

/**
 * Assist test outcomes by tier
 *   T1: bane on the assisted creature's test
 *   T2: edge on the assisted creature's test
 *   T3: double edge on the assisted creature's test
 */
export const ASSIST_OUTCOMES = {
  1: { key: "bane", label: "MONTAGE.Assist.Bane" },
  2: { key: "edge", label: "MONTAGE.Assist.Edge" },
  3: { key: "doubleEdge", label: "MONTAGE.Assist.DoubleEdge" },
};

/**
 * Socket event types
 */
export const SOCKET_EVENTS = {
  STATE_UPDATE: "stateUpdate",
  ACTION_SUBMIT: "actionSubmit",
  ACTION_APPROVED: "actionApproved",
  ACTION_REJECTED: "actionRejected",
  ROLL_RESULT: "rollResult",
  REQUEST_REFRESH: "requestRefresh",
  ROUND_ADVANCED: "roundAdvanced",
  TEST_RESOLVED: "testResolved",
  MONTAGE_ACTIVATED: "montageActivated",
};

/**
 * Default montage test difficulty table for 5 heroes.
 * Adjustments: ±1 per hero above/below 5 (min limits: 2)
 */
export const DIFFICULTY_TABLE_BASE = {
  easy: { successLimit: 5, failureLimit: 5 },
  moderate: { successLimit: 6, failureLimit: 4 },
  hard: { successLimit: 7, failureLimit: 3 },
};

/**
 * Victories awarded by outcome and difficulty
 */
export const VICTORIES = {
  totalSuccess: { easy: 1, moderate: 1, hard: 2 },
  partialSuccess: { easy: 0, moderate: 1, hard: 1 },
  totalFailure: { easy: 0, moderate: 0, hard: 0 },
};

/**
 * Default number of montage test rounds
 */
export const DEFAULT_MAX_ROUNDS = 2;

/**
 * Base hero count the difficulty table is designed for
 */
export const BASE_HERO_COUNT = 5;

/**
 * Minimum value for success/failure limits
 */
export const MIN_LIMIT = 2;
