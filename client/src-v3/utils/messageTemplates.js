// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V5.1.0 — utils/messageTemplates.js
// Default subject and body for each guest message kind, plus the labels the
// composer and the Messages log share. Merge fields are filled in by
// api/_lib/guest-send.js (server side); this file only supplies the wording.
//
// Kinds match message_log.kind. Channels match message_log.channel.
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGE_KINDS = [
  { key: "save_the_date", label: "Save the Date",  manual: true  },
  { key: "invitation",    label: "Invitation",     manual: true  },
  { key: "rsvp_reminder", label: "RSVP reminder",  manual: true  },
  { key: "thank_you",     label: "Thank-you",      manual: true  },
  { key: "custom",        label: "Custom message", manual: false },
];

const kindLabel = (key) => MESSAGE_KINDS.find(k => k.key === key)?.label || key;

// Channels a host can record without sending from SimchaKit (see "Mark as sent").
const MANUAL_CHANNELS = [
  { key: "paper",    label: "Paper mail" },
  { key: "external", label: "Another platform" },
];

const channelLabel = (key) =>
  key === "paper" ? "Paper mail" : key === "external" ? "Another platform" : "Email";

const MERGE_FIELDS = [
  { key: "household_name",   label: "Household name" },
  { key: "rsvp_link",        label: "RSVP link" },
  { key: "event_name",       label: "Event name" },
  { key: "event_date",       label: "Event date" },
  { key: "venue",            label: "Venue" },
  { key: "host_names",       label: "Host names" },
  { key: "gift_description", label: "Gift description" },
];

// Warm, plain wording. The reply-to address is the host's, so guests can answer
// by replying. Invitations and reminders also carry {{rsvp_link}}: each household's private
// reply link, shown as a button in the email where the host puts it.
const DEFAULT_TEMPLATES = {
  save_the_date: {
    subject: "Save the date: {{event_name}}",
    body:
`Dear {{household_name}},

We are so happy to share the date of {{event_name}}: {{event_date}}.

Please mark your calendar. A formal invitation with all the details will follow.

With love,
{{host_names}}`,
  },
  invitation: {
    subject: "You're invited: {{event_name}}",
    body:
`Dear {{household_name}},

You are warmly invited to {{event_name}}.

Date: {{event_date}}
Place: {{venue}}

We would love to celebrate with you. Please let us know if you can join us:

{{rsvp_link}}

With love,
{{host_names}}`,
  },
  rsvp_reminder: {
    subject: "A gentle reminder: {{event_name}}",
    body:
`Dear {{household_name}},

We hope you are well! We haven't heard whether you can join us for {{event_name}} on {{event_date}}, and we would love to know.

It only takes a minute:

{{rsvp_link}}

Thank you!

With love,
{{host_names}}`,
  },
  thank_you: {
    subject: "Thank you from {{host_names}}",
    body:
`Dear {{household_name}},

Thank you for celebrating {{event_name}} with us, and for your thoughtful gift: {{gift_description}}.

Having you there meant so much to our family.

With love,
{{host_names}}`,
  },
  custom: {
    subject: "{{event_name}}",
    body:
`Dear {{household_name}},

`,
  },
};

export { MESSAGE_KINDS, MANUAL_CHANNELS, MERGE_FIELDS, DEFAULT_TEMPLATES, kindLabel, channelLabel };
