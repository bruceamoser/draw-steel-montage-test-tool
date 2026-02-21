import { MODULE_ID } from "../config.mjs";

/**
 * Post a montage-related chat message visible to all.
 * @param {string} content - HTML content
 * @param {object} [options={}]
 * @param {string} [options.speaker] - Speaker alias
 * @param {boolean} [options.whisper] - Whisper to GM only
 */
export async function postChatMessage(content, options = {}) {
  const messageData = {
    content,
    speaker: { alias: options.speaker ?? game.i18n.localize("MONTAGE.Title") },
    flags: { [MODULE_ID]: { montage: true } },
  };

  if (options.whisper) {
    messageData.whisper = game.users.filter((u) => u.isGM).map((u) => u.id);
  }

  return ChatMessage.create(messageData);
}

/**
 * Post a round summary to chat.
 * @param {object} testData - The montage test data
 * @param {object} roundData - The round data to summarize
 */
export async function postRoundSummary(testData, roundData) {
  const actions = roundData.actions.map((a) => {
    const hero = testData.heroes.find((h) => h.actorId === a.actorId);
    const heroName = hero?.name ?? "Unknown Hero";
    return { ...a, heroName };
  });

  const templateData = {
    testName: testData.name,
    roundNumber: roundData.roundNumber,
    maxRounds: testData.maxRounds,
    actions,
    currentSuccesses: testData.currentSuccesses,
    currentFailures: testData.currentFailures,
    successLimit: testData.successLimit,
    failureLimit: testData.failureLimit,
  };

  const content = await renderTemplate(
    `modules/${MODULE_ID}/templates/chat/round-summary.hbs`,
    templateData,
  );
  return postChatMessage(content);
}

/**
 * Post a test completion message to chat.
 * @param {object} testData - The completed montage test data
 */
export async function postTestComplete(testData) {
  const templateData = {
    testName: testData.name,
    outcome: testData.outcome,
    outcomeLabel: game.i18n.localize(`MONTAGE.Outcome.${testData.outcome.charAt(0).toUpperCase() + testData.outcome.slice(1)}`),
    currentSuccesses: testData.currentSuccesses,
    currentFailures: testData.currentFailures,
    successLimit: testData.successLimit,
    failureLimit: testData.failureLimit,
    victories: testData.victories ?? 0,
    difficulty: testData.difficulty,
    rounds: testData.rounds,
    heroes: testData.heroes,
    gmNotes: testData.gmNotes,
  };

  const content = await renderTemplate(
    `modules/${MODULE_ID}/templates/chat/test-complete.hbs`,
    templateData,
  );
  return postChatMessage(content);
}

/**
 * Post a notification when a player submits an action for GM approval.
 * @param {object} actionData
 * @param {string} heroName
 */
export async function postActionSubmitted(actionData, heroName) {
  const typeLabel = game.i18n.localize(`MONTAGE.Action.${actionData.type.charAt(0).toUpperCase() + actionData.type.slice(1)}`);
  const content = `<div class="montage-chat-action">
    <strong>${heroName}</strong> ${game.i18n.localize("MONTAGE.Chat.WantsTo")} <em>${typeLabel}</em>
    ${actionData.description ? `<p class="montage-action-desc">${actionData.description}</p>` : ""}
  </div>`;
  return postChatMessage(content, { whisper: true, speaker: heroName });
}
