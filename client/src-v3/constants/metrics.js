// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.32.0: constants/metrics.js
// Wording for the "i" info popovers on the guest-count stat cards. Every
// definition is written once here and reused by every screen, so the same
// number can never be described two different ways.
//
// Vocabulary used everywhere in the app:
//   Total Guests  everyone on the guest list, whatever their RSVP
//   Confirmed     the guest's own Yes
//   Awaiting      invited, no answer yet
//   Expected      confirmed plus awaiting (declined guests left out)
//
// "precise" is true once at least one timeline sub-event is flagged "Meal
// served" in Admin Mode; until then the counts follow household RSVP status
// (see getMealPopulation in utils/sections.js).
//
// Popovers hold the extra detail only. Anything a reader needs to interpret a
// number (which event, what is excluded) belongs in the visible label or
// sub-line on the card itself.
// ─────────────────────────────────────────────────────────────────────────────

export const METRIC_HELP = {
  confirmed: ({ precise }) => precise
    ? [
        "Guests whose own answer is Yes for a sub-event where a meal is served (marked Meal served in Admin Mode).",
        "Guests who declined are not counted.",
      ]
    : [
        "Guests in households that RSVP'd Yes.",
        "Mark the sub-events where a meal is served (Admin Mode, Timeline) to count each guest's own Yes instead.",
      ],

  expected: ({ precise }) => precise
    ? [
        "Confirmed guests plus guests still awaiting an answer.",
        "Guests who declined are left out. This is the headcount to plan around.",
      ]
    : [
        "Everyone on the guest list.",
        "Mark the sub-events where a meal is served (Admin Mode, Timeline) to leave out guests who declined.",
      ],

  awaiting: ({ precise }) => precise
    ? [
        "Guests invited to a meal who have not answered Yes or No yet.",
      ]
    : [
        "Everyone not yet confirmed. Households that said No are included here, because guests are not tracked one by one.",
        "Mark the sub-events where a meal is served (Admin Mode, Timeline) for exact counts.",
      ],

  attending: ({ eventTitle, rsvpYesHouseholds }) => [
    `Guests marked Yes for ${eventTitle || "the main event"}, counted in households that RSVP'd Yes${typeof rsvpYesHouseholds === "number" ? ` (${rsvpYesHouseholds} households)` : ""}.`,
    "A household's Attending Count Override, if set, takes priority.",
    "This can differ from the meal counts, which follow the sub-events where a meal is served.",
  ],

  kosher: ({ pending }) => [
    "Guests flagged Kosher meal required who are confirmed for a meal.",
    pending > 0
      ? `${pending} kosher ${pending === 1 ? "guest is" : "guests are"} still awaiting an answer.`
      : "Kosher guests still awaiting an answer are noted as pending.",
  ],

  kosherDayOf: () => [
    "Confirmed guests flagged Kosher meal required.",
  ],

  dietary: () => [
    "Expected guests who have dietary notes or are flagged Kosher meal required.",
  ],

  seated: () => [
    "Guests confirmed for this sub-event who have a table.",
    "Guests who declined or have not answered are not counted here.",
  ],

  unseated: () => [
    "Guests confirmed for this sub-event who do not have a table yet.",
    "Guests still awaiting an answer are shown separately as TBD.",
  ],
};
