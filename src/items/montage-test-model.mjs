/**
 * Montage Test Item Data Model
 * Foundry VTT v13+ TypeDataModel for Item type: "montageTest".
 */

export const MONTAGE_TEST_ITEM_TYPE = "montageTest";

export const MONTAGE_TEST_RESULT = {
  SUCCESS: "success",
  FAIL: "fail",
  NEITHER: "neither",
};

export const MONTAGE_TEST_OUTCOME = {
  TOTAL_SUCCESS: "totalSuccess",
  PARTIAL_SUCCESS: "partialSuccess",
  TOTAL_FAILURE: "totalFailure",
};

/**
 * Compute total successes and failures based on participant round marks.
 * @param {Array<{round1?: string, round2?: string}>} participants
 */
export function tallyParticipants(participants = []) {
  let successes = 0;
  let failures = 0;

  for (const p of participants) {
    for (const key of ["round1", "round2"]) {
      const v = p?.[key];
      if (v === MONTAGE_TEST_RESULT.SUCCESS) successes += 1;
      else if (v === MONTAGE_TEST_RESULT.FAIL) failures += 1;
    }
  }

  return { successes, failures };
}

/**
 * Determine the montage outcome using the resolution rules documented in this repo.
 * Returns null until the test is "eligible" to resolve (limits reached or all marks entered).
 *
 * Resolution rules (from README):
 * - Total Success: successes reach the limit
 * - Otherwise if time/failures run out:
 *   - Partial Success if successes - failures >= 2
 *   - Total Failure otherwise
 */
export function computeOutcome({ successes, failures, successLimit, failureLimit, allMarksEntered }) {
  if (successLimit > 0 && successes >= successLimit) return MONTAGE_TEST_OUTCOME.TOTAL_SUCCESS;

  const failuresReached = failureLimit > 0 && failures >= failureLimit;
  const timeRanOut = !!allMarksEntered;

  if (!failuresReached && !timeRanOut) return null;

  return (successes - failures) >= 2
    ? MONTAGE_TEST_OUTCOME.PARTIAL_SUCCESS
    : MONTAGE_TEST_OUTCOME.TOTAL_FAILURE;
}

/**
 * The TypeDataModel backing Item.system for montage tests.
 */
export class MontageTestDataModel extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;

    const createResultField = () => new fields.StringField({
      required: false,
      blank: true,
      initial: "",
      choices: ["", MONTAGE_TEST_RESULT.SUCCESS, MONTAGE_TEST_RESULT.FAIL, MONTAGE_TEST_RESULT.NEITHER],
    });

    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),

      difficulty: new fields.StringField({
        required: true,
        initial: "moderate",
        choices: ["easy", "moderate", "hard"],
      }),

      successLimit: new fields.NumberField({ required: true, integer: true, min: 1, initial: 6 }),
      failureLimit: new fields.NumberField({ required: true, integer: true, min: 1, initial: 4 }),

      complications: new fields.SchemaField({
        round1: new fields.ArrayField(new fields.StringField({ required: false, blank: true, initial: "" }), {
          required: true,
          initial: [],
        }),
        round2: new fields.ArrayField(new fields.StringField({ required: false, blank: true, initial: "" }), {
          required: true,
          initial: [],
        }),
      }),

      outcomes: new fields.SchemaField({
        totalSuccess: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        partialSuccess: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        totalFailure: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      }),

      participants: new fields.ArrayField(
        new fields.SchemaField({
          actorUuid: new fields.StringField({ required: false, blank: true, initial: "" }),
          name: new fields.StringField({ required: false, blank: true, initial: "" }),
          img: new fields.StringField({ required: false, blank: true, initial: "" }),
          round1: createResultField(),
          round2: createResultField(),
        }),
        { required: true, initial: [] },
      ),
    };
  }
}
