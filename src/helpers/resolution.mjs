import { MONTAGE_OUTCOME, VICTORIES } from "../config.mjs";

/**
 * Evaluate whether a montage test should resolve, and determine the outcome.
 *
 * Rules:
 *   - Total Success: successes >= successLimit before failureLimit or rounds end.
 *   - Total Failure: failures >= failureLimit OR rounds ended, AND successes - failures < 2.
 *   - Partial Success: failures >= failureLimit OR rounds ended, AND successes - failures >= 2.
 *
 * @param {object} testData - The montage test data object
 * @returns {{ resolved: boolean, outcome: string|null, victories: number }}
 */
export function evaluateResolution(testData) {
  const {
    currentSuccesses,
    currentFailures,
    successLimit,
    failureLimit,
    currentRound,
    maxRounds,
  } = testData;

  // Check total success
  if (currentSuccesses >= successLimit) {
    const victories = VICTORIES.totalSuccess[testData.difficulty] ?? 0;
    return {
      resolved: true,
      outcome: MONTAGE_OUTCOME.TOTAL_SUCCESS,
      victories,
    };
  }

  // Check failure limit hit or rounds exhausted
  const failureLimitHit = currentFailures >= failureLimit;
  const roundsExhausted = currentRound > maxRounds;

  if (failureLimitHit || roundsExhausted) {
    const margin = currentSuccesses - currentFailures;

    if (margin >= 2) {
      const victories = VICTORIES.partialSuccess[testData.difficulty] ?? 0;
      return {
        resolved: true,
        outcome: MONTAGE_OUTCOME.PARTIAL_SUCCESS,
        victories,
      };
    } else {
      return {
        resolved: true,
        outcome: MONTAGE_OUTCOME.TOTAL_FAILURE,
        victories: 0,
      };
    }
  }

  return { resolved: false, outcome: null, victories: 0 };
}

/**
 * Check if all heroes have resolved their actions for the current round.
 * @param {object} testData
 * @returns {boolean}
 */
export function isRoundComplete(testData) {
  const currentRoundData = getCurrentRound(testData);
  if (!currentRoundData) return false;

  return currentRoundData.actions.length >= testData.heroes.length
    && currentRoundData.actions.every((a) => a.resolved);
}

/**
 * Get the current round data object.
 * @param {object} testData
 * @returns {object|null}
 */
export function getCurrentRound(testData) {
  return testData.rounds.find((r) => r.roundNumber === testData.currentRound) ?? null;
}

/**
 * Check if a hero has already acted this round.
 * @param {object} testData
 * @param {string} actorId
 * @returns {boolean}
 */
export function hasHeroActedThisRound(testData, actorId) {
  const round = getCurrentRound(testData);
  if (!round) return false;
  return round.actions.some((a) => a.actorId === actorId);
}

/**
 * Get the list of heroes who have not yet acted this round.
 * @param {object} testData
 * @returns {Array<object>}
 */
export function getHeroesWaiting(testData) {
  const round = getCurrentRound(testData);
  if (!round) return [...testData.heroes];

  const actedIds = new Set(round.actions.map((a) => a.actorId));
  return testData.heroes.filter((h) => !actedIds.has(h.actorId));
}

/**
 * Get the list of heroes who have acted this round.
 * @param {object} testData
 * @returns {Array<object>}
 */
export function getHeroesActed(testData) {
  const round = getCurrentRound(testData);
  if (!round) return [];

  const actedIds = new Set(round.actions.filter((a) => a.resolved).map((a) => a.actorId));
  return testData.heroes.filter((h) => actedIds.has(h.actorId));
}

/**
 * Get a human-readable outcome label
 * @param {string} outcome - MONTAGE_OUTCOME value
 * @returns {string} i18n key
 */
export function getOutcomeLabel(outcome) {
  switch (outcome) {
    case MONTAGE_OUTCOME.TOTAL_SUCCESS:
      return "MONTAGE.Outcome.TotalSuccess";
    case MONTAGE_OUTCOME.PARTIAL_SUCCESS:
      return "MONTAGE.Outcome.PartialSuccess";
    case MONTAGE_OUTCOME.TOTAL_FAILURE:
      return "MONTAGE.Outcome.TotalFailure";
    default:
      return "MONTAGE.Outcome.Unknown";
  }
}
