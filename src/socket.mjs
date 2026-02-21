import { MODULE_ID, SOCKET_NAME, SOCKET_EVENTS, TEST_STATUS, ACTION_TYPE } from "../config.mjs";
import {
  loadActiveTest,
  saveActiveTest,
  createActionData,
  createRoundData,
} from "../data/montage-test.mjs";
import { getTier, getTestOutcome, getAssistOutcome } from "../helpers/difficulty.mjs";
import { evaluateResolution, isRoundComplete, getCurrentRound } from "../helpers/resolution.mjs";
import { postRoundSummary, postTestComplete, postActionSubmitted } from "../helpers/chat.mjs";

/**
 * Callbacks registered by UI components to respond to state changes.
 * @type {Set<Function>}
 */
const stateListeners = new Set();

/**
 * Callbacks registered for pending action notifications (GM approval queue).
 * @type {Set<Function>}
 */
const pendingActionListeners = new Set();

/**
 * Register a callback for montage test state updates.
 * @param {Function} fn - Called with (testData) whenever state changes
 * @returns {Function} Unsubscribe function
 */
export function onStateUpdate(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

/**
 * Register a callback for pending action notifications (GM only).
 * @param {Function} fn - Called with (actionData) when a player submits an action
 * @returns {Function} Unsubscribe function
 */
export function onPendingAction(fn) {
  pendingActionListeners.add(fn);
  return () => pendingActionListeners.delete(fn);
}

/**
 * Notify all registered state listeners.
 * @param {object} testData
 */
function notifyStateListeners(testData) {
  for (const fn of stateListeners) {
    try {
      fn(testData);
    } catch (err) {
      console.error(`${MODULE_ID} | State listener error:`, err);
    }
  }
}

/**
 * Broadcast the current test state to all connected clients via socket.
 * @param {object} testData
 */
function broadcastState(testData) {
  game.socket.emit(SOCKET_NAME, {
    event: SOCKET_EVENTS.STATE_UPDATE,
    data: testData,
  });
  // Also notify local listeners
  notifyStateListeners(testData);
}

/**
 * Initialize the socket handler. Called during module ready hook.
 */
export function initSocket() {
  game.socket.on(SOCKET_NAME, (payload) => {
    const { event, data } = payload;

    switch (event) {
      case SOCKET_EVENTS.STATE_UPDATE:
        notifyStateListeners(data);
        break;

      case SOCKET_EVENTS.ACTION_SUBMIT:
        // Only GM processes action submissions
        if (game.user.isGM) {
          handleActionSubmission(data);
        }
        break;

      case SOCKET_EVENTS.ACTION_APPROVED:
      case SOCKET_EVENTS.ACTION_REJECTED:
        // Players listen for approval/rejection of their actions
        if (data.userId === game.user.id) {
          notifyStateListeners(loadActiveTest());
        }
        break;

      case SOCKET_EVENTS.ROLL_RESULT:
        // GM processes incoming roll results
        if (game.user.isGM) {
          handleRollResult(data);
        }
        break;

      case SOCKET_EVENTS.REQUEST_REFRESH:
        // GM responds with current state
        if (game.user.isGM) {
          const testData = loadActiveTest();
          if (testData) broadcastState(testData);
        }
        break;

      case SOCKET_EVENTS.ROUND_ADVANCED:
      case SOCKET_EVENTS.TEST_RESOLVED:
        notifyStateListeners(data);
        break;

      default:
        console.warn(`${MODULE_ID} | Unknown socket event: ${event}`);
    }
  });
}

/**
 * Request a state refresh from the GM (used by players on connect).
 */
export function requestRefresh() {
  game.socket.emit(SOCKET_NAME, {
    event: SOCKET_EVENTS.REQUEST_REFRESH,
  });
}

/**
 * Player submits an action for GM approval.
 * @param {object} actionData - { actorId, type, description, aidTarget }
 */
export function submitAction(actionData) {
  const payload = {
    ...actionData,
    userId: game.user.id,
  };

  // If acting as GM on behalf of a player, handle directly
  if (game.user.isGM) {
    handleActionSubmission(payload);
    return;
  }

  game.socket.emit(SOCKET_NAME, {
    event: SOCKET_EVENTS.ACTION_SUBMIT,
    data: payload,
  });
}

/**
 * GM-side: Handle an incoming action submission from a player.
 * Queues it for approval.
 * @param {object} data
 */
async function handleActionSubmission(data) {
  const testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.ACTIVE) return;

  // Add to pending actions queue
  testData.pendingActions = testData.pendingActions ?? [];
  testData.pendingActions.push(data);
  await saveActiveTest(testData);

  // Notify GM UI about pending action
  const hero = testData.heroes.find((h) => h.actorId === data.actorId);
  const heroName = hero?.name ?? "Unknown";

  // Post a whispered chat message for the GM
  await postActionSubmitted(data, heroName);

  // Notify pending action listeners (GM approval UI)
  for (const fn of pendingActionListeners) {
    try {
      fn(data);
    } catch (err) {
      console.error(`${MODULE_ID} | Pending action listener error:`, err);
    }
  }

  broadcastState(testData);
}

/**
 * GM approves a pending action.
 * @param {string} actorId - The hero's actor ID
 * @param {object} approvalData - { difficulty, autoSuccesses, gmNotes }
 */
export async function approveAction(actorId, approvalData = {}) {
  const testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.ACTIVE) return;

  // Find and remove from pending
  const pendingIdx = testData.pendingActions.findIndex((a) => a.actorId === actorId);
  if (pendingIdx === -1) return;

  const pending = testData.pendingActions.splice(pendingIdx, 1)[0];

  // Ensure current round exists
  let round = testData.rounds.find((r) => r.roundNumber === testData.currentRound);
  if (!round) {
    round = createRoundData(testData.currentRound);
    testData.rounds.push(round);
  }

  // Handle "do nothing" immediately
  if (pending.type === ACTION_TYPE.NOTHING) {
    const action = createActionData({
      actorId: pending.actorId,
      type: ACTION_TYPE.NOTHING,
      description: pending.description ?? "Does nothing this round.",
      approved: true,
      resolved: true,
    });
    round.actions.push(action);
    await saveActiveTest(testData);
    broadcastState(testData);

    // Check if round is complete
    await checkRoundCompletion(testData);
    return;
  }

  // Handle "use ability" — GM awards auto-successes
  if (pending.type === ACTION_TYPE.ABILITY) {
    const autoSuccesses = approvalData.autoSuccesses ?? 0;
    const action = createActionData({
      actorId: pending.actorId,
      type: ACTION_TYPE.ABILITY,
      description: pending.description,
      autoSuccesses,
      isSuccess: autoSuccesses > 0,
      approved: true,
      resolved: true,
      gmNotes: approvalData.gmNotes ?? "",
    });
    round.actions.push(action);
    testData.currentSuccesses += autoSuccesses;
    await saveActiveTest(testData);
    broadcastState(testData);

    await checkRoundCompletion(testData);
    return;
  }

  // For "roll" and "aid" — mark as approved, awaiting roll result
  const action = createActionData({
    actorId: pending.actorId,
    type: pending.type,
    description: pending.description,
    difficulty: approvalData.difficulty ?? null,
    aidTarget: pending.aidTarget ?? null,
    approved: true,
    resolved: false,
    gmNotes: approvalData.gmNotes ?? "",
  });
  round.actions.push(action);
  await saveActiveTest(testData);

  // Notify the player that their action is approved
  game.socket.emit(SOCKET_NAME, {
    event: SOCKET_EVENTS.ACTION_APPROVED,
    data: {
      actorId: pending.actorId,
      userId: pending.userId,
      type: pending.type,
      difficulty: approvalData.difficulty,
      aidTarget: pending.aidTarget,
    },
  });

  broadcastState(testData);
}

/**
 * GM rejects a pending action.
 * @param {string} actorId
 * @param {string} [reason]
 */
export async function rejectAction(actorId, reason = "") {
  const testData = loadActiveTest();
  if (!testData) return;

  const pendingIdx = testData.pendingActions.findIndex((a) => a.actorId === actorId);
  if (pendingIdx === -1) return;

  const pending = testData.pendingActions.splice(pendingIdx, 1)[0];
  await saveActiveTest(testData);

  game.socket.emit(SOCKET_NAME, {
    event: SOCKET_EVENTS.ACTION_REJECTED,
    data: {
      actorId: pending.actorId,
      userId: pending.userId,
      reason,
    },
  });

  broadcastState(testData);
}

/**
 * Process a roll result submitted by a player or entered by the GM.
 * @param {object} data - { actorId, rollTotal, naturalRoll }
 */
export async function handleRollResult(data) {
  const testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.ACTIVE) return;

  const round = getCurrentRound(testData);
  if (!round) return;

  const action = round.actions.find(
    (a) => a.actorId === data.actorId && a.approved && !a.resolved,
  );
  if (!action) return;

  const tier = getTier(data.rollTotal);
  const isNat19or20 = data.naturalRoll >= 19;

  action.rollTotal = data.rollTotal;
  action.naturalRoll = data.naturalRoll;
  action.tier = tier;

  if (action.type === ACTION_TYPE.AID) {
    // Assist roll
    const assistOutcome = getAssistOutcome(tier);
    action.aidResult = assistOutcome.key;
    action.resolved = true;
    // Aid doesn't directly add successes/failures to the montage tally
  } else if (action.type === ACTION_TYPE.ROLL) {
    // Standard test roll
    if (action.difficulty) {
      const outcome = getTestOutcome(action.difficulty, tier, isNat19or20);
      action.outcome = outcome.key;
      action.isSuccess = outcome.isSuccess;

      if (outcome.isSuccess) {
        testData.currentSuccesses += 1;
      } else {
        testData.currentFailures += 1;
      }
    }
    action.resolved = true;
  }

  await saveActiveTest(testData);
  broadcastState(testData);

  await checkRoundCompletion(testData);
}

/**
 * GM manually adjusts successes or failures.
 * @param {object} adjustments - { successes, failures }
 */
export async function adjustTally(adjustments) {
  const testData = loadActiveTest();
  if (!testData) return;

  if (typeof adjustments.successes === "number") {
    testData.currentSuccesses = Math.max(0, adjustments.successes);
  }
  if (typeof adjustments.failures === "number") {
    testData.currentFailures = Math.max(0, adjustments.failures);
  }

  await saveActiveTest(testData);
  broadcastState(testData);

  // Check resolution after manual adjustment
  const resolution = evaluateResolution(testData);
  if (resolution.resolved) {
    await resolveTest(testData, resolution);
  }
}

/**
 * Check if the current round is complete, and if so, advance or resolve.
 * @param {object} testData
 */
async function checkRoundCompletion(testData) {
  // Reload from flags to get latest state
  testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.ACTIVE) return;

  if (!isRoundComplete(testData)) return;

  // Check resolution
  const resolution = evaluateResolution(testData);
  if (resolution.resolved) {
    await resolveTest(testData, resolution);
    return;
  }

  // Post round summary to chat
  const round = getCurrentRound(testData);
  if (round) {
    await postRoundSummary(testData, round);
  }

  // Advance to next round
  if (testData.currentRound < testData.maxRounds) {
    testData.currentRound += 1;
    testData.rounds.push(createRoundData(testData.currentRound));
    await saveActiveTest(testData);
    broadcastState(testData);
  } else {
    // Rounds exhausted — force resolution
    testData.currentRound += 1; // Triggers roundsExhausted check
    const finalResolution = evaluateResolution(testData);
    await resolveTest(testData, finalResolution);
  }
}

/**
 * Resolve the montage test with a final outcome.
 * @param {object} testData
 * @param {object} resolution - { outcome, victories }
 */
async function resolveTest(testData, resolution) {
  testData.status = TEST_STATUS.RESOLVED;
  testData.outcome = resolution.outcome;
  testData.victories = resolution.victories;
  testData.pendingActions = [];

  await saveActiveTest(testData);

  // Post completion to chat
  await postTestComplete(testData);

  broadcastState(testData);

  game.socket.emit(SOCKET_NAME, {
    event: SOCKET_EVENTS.TEST_RESOLVED,
    data: testData,
  });
}

/**
 * GM activates a montage test that's in setup status.
 */
export async function activateTest() {
  const testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.SETUP) return;

  testData.status = TEST_STATUS.ACTIVE;
  testData.currentRound = 1;
  testData.rounds = [createRoundData(1)];
  testData.pendingActions = [];

  await saveActiveTest(testData);
  broadcastState(testData);

  ui.notifications.info(game.i18n.format("MONTAGE.Notify.TestActivated", { name: testData.name }));
}

/**
 * GM manually ends the test early and forces resolution.
 */
export async function endTestEarly() {
  const testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.ACTIVE) return;

  // Force rounds exhausted
  testData.currentRound = testData.maxRounds + 1;
  const resolution = evaluateResolution(testData);
  await resolveTest(testData, resolution);
}

/**
 * GM manually advances to the next round.
 */
export async function advanceRound() {
  const testData = loadActiveTest();
  if (!testData || testData.status !== TEST_STATUS.ACTIVE) return;

  // Post round summary
  const round = getCurrentRound(testData);
  if (round) {
    await postRoundSummary(testData, round);
  }

  // Check resolution first
  const resolution = evaluateResolution(testData);
  if (resolution.resolved) {
    await resolveTest(testData, resolution);
    return;
  }

  if (testData.currentRound >= testData.maxRounds) {
    // Force end
    testData.currentRound = testData.maxRounds + 1;
    const finalResolution = evaluateResolution(testData);
    await resolveTest(testData, finalResolution);
    return;
  }

  testData.currentRound += 1;
  testData.rounds.push(createRoundData(testData.currentRound));
  testData.pendingActions = [];
  await saveActiveTest(testData);

  broadcastState(testData);
  ui.notifications.info(game.i18n.format("MONTAGE.Notify.RoundAdvanced", {
    round: testData.currentRound,
    max: testData.maxRounds,
  }));
}
