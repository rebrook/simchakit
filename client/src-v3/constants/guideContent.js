// Guide content (V5-H1). Sections are grouped for the rail; topics are short articles.
// Text was moved from the old GUIDE_SECTIONS without rewording: summaries are new one-liners, steps/body/tip are the
// original sentences. tabs: the tab ids whose "Help for this tab" button opens that section or topic.
export const GUIDE_SECTIONS = [
  {
    "id": "getting-started",
    "group": "Set up",
    "title": "Getting Started",
    "color": "var(--accent-primary)",
    "topics": [
      {
        "id": "how-simchakit-works",
        "title": "How SimchaKit works",
        "summary": "One event, one link, synced live on every device.",
        "body": [
          "SimchaKit is a single-event planning dashboard. Each event has its own URL and data store. All changes sync in real time — open the same URL on any device and you'll see the same data instantly. The sync indicator in the top bar shows connection status."
        ]
      },
      {
        "id": "admin-mode",
        "title": "Admin Mode",
        "summary": "Where the owner sets up the event.",
        "body": [
          "Admin Mode (the settings gear in the sidebar footer) is where you configure the event — name, type, theme, RSVP URL, timeline, guest groups, meal choices, and catering style. Admin Mode is owner-only. Most tabs read from Admin config, so set it up first. Changes save immediately."
        ]
      },
      {
        "id": "your-name",
        "title": "Your name",
        "summary": "The name your co-planners see, and how to change it.",
        "body": [
          "When you first sign in, SimchaKit will ask what to call you. Your name appears in the event picker footer, in the app footer, in invitation emails sent to your co-planners, and in the collaborator panel for events you have been invited to. You can use a first name, full name, or nickname -- whatever you prefer.",
          "To update your name at any time, click your name in the event picker footer. Your name is visible to collaborators you invite -- they will see it in the invitation email and in the collaborator panel."
        ]
      },
      {
        "id": "archived-events",
        "title": "Archived events",
        "summary": "Archiving locks an event so it becomes read-only.",
        "body": [
          "Archiving an event (in Admin Mode) locks all data and disables editing. Archived events are read-only. The banner at the top of each tab indicates archived status."
        ]
      },
      {
        "id": "switching-between-events",
        "title": "Switching between events",
        "summary": "Move between your events and ones shared with you.",
        "steps": [
          "On a computer, click the event name at the top of the sidebar to open a list of your events, including events shared with you.",
          "Pick one to switch with a single click.",
          "Choose All events at the bottom of the list to return to the full event picker."
        ],
        "body": [
          "The event you are in is checked, and archived events are tagged and open read-only. On a phone, tap the back arrow at the top to return to your events and choose another."
        ],
        "tip": "Cmd-click or Ctrl-click an event to open it in a new tab."
      },
      {
        "id": "export-backup",
        "title": "Export & backup",
        "summary": "Save a full copy of your event data.",
        "steps": [
          "Use the Export button in Admin Mode → Data to save a full JSON backup of your event data."
        ],
        "body": [
          "Two options: Copy to Clipboard (paste into a text editor and save as .json) or ⬇ Download File (saves directly to your device as a .json file — no extra steps needed). Individual tabs (Budget, Gifts) have CSV export options.",
          "The Guests tab has a dedicated Export Guests modal with four formats: By Household, By Person, Mailing / Invitations, and a Printable View — each tailored to a specific audience such as catering, invitation vendor, or day-of staff."
        ],
        "tip": "Export before making major changes or archiving.",
        "related": [
          [
            "getting-started",
            "restoring-from-backup"
          ]
        ]
      },
      {
        "id": "restoring-from-backup",
        "title": "Restoring from backup",
        "summary": "Load a saved .json file back into the event.",
        "steps": [
          "Select your .json backup file.",
          "Type RESTORE BACKUP in the confirmation field.",
          "Click Restore from Backup."
        ],
        "body": [
          "To restore event data from a backup file, go to Admin Mode → Data → Restore from Backup. What is restored: all guests, people, budget, vendors, tasks, prep, seating, gifts, favors, ceremony roles, and notes. What is preserved: event configuration (name, theme, timeline), and archived status. Restore is blocked on archived events."
        ],
        "tip": "This action cannot be undone — export a fresh backup first if you want to save your current data.",
        "related": [
          [
            "getting-started",
            "export-backup"
          ]
        ]
      }
    ]
  },
  {
    "id": "guests",
    "group": "Guests and invitations",
    "title": "Guests",
    "color": "var(--accent-primary)",
    "tabs": [
      "guests"
    ],
    "topics": [
      {
        "id": "households-vs-people",
        "title": "Households vs. people",
        "summary": "One invitation per household, with each person inside it.",
        "body": [
          "Guests are organized as households (one invitation) containing individual people. A household tracks the formal invitation name, structured address (street, city, state/province, postal code, country), RSVP status, and which sub-events the household is invited to. People within a household track individual details — title, dietary needs, meal choice, shirt size, seating, and which sub-events each person is confirmed to attend.",
          "When editing an existing household, the modal opens in tab mode (Details, Address, Members, Flags & Notes, Contact Log) so you can jump directly to the section you need. Adding a new household uses a two-step guided flow."
        ]
      },
      {
        "id": "rsvp-statuses",
        "title": "RSVP statuses",
        "summary": "What each status and stat card number means.",
        "body": [
          "Statuses flow from Invited → RSVP Yes / RSVP No, with Pending and Maybe as intermediate states. The Guests tab badge in the navigation shows how many households are still awaiting an RSVP, and it disappears once every household has responded. Stat cards that count guests have a small i button; tap it to see how the number is counted.",
          "The words mean the same thing everywhere: Total Guests is everyone on the guest list, Confirmed is a guest's own Yes, Awaiting is invited with no answer yet, and Expected is confirmed plus awaiting with guests who declined left out.",
          "The stat grid breaks down attending (guests marked Yes for the main event, counted in households that RSVP'd Yes and adjusted by any Attending Count Override, so it can differ from the meal counts), out-of-town, save-the-dates sent, invites sent, kippot needed, kosher meals, and address completion."
        ]
      },
      {
        "id": "sub-event-attendance",
        "title": "Sub-event attendance",
        "summary": "How sub-events are invited and answered by household.",
        "body": [
          "Sub-event tracking works in two tiers, and only appears once your event has more than one sub-event defined in Admin Mode's timeline (sub-events are always listed in date and time order, matching Admin Mode).",
          "Tier 1 (household): each sub-event has its own row in the Sub-Events section when adding or editing a household, with a checkbox and, once invited, a status pill and an attending summary in that same row -- there is no separate invite checklist and RSVP list to keep in sync, it is one table.",
          "Most sub-events default to inviting every household automatically (set in Admin Mode's Timeline); a sub-event marked 'invite all by default' shows a checked, disabled box and just the status pill, while a sub-event switched to opt-in-only in Admin Mode needs each invited household checked individually.",
          "A status pill defaults to the household's own overall RSVP status until you set it explicitly, and automatically becomes RSVP Yes as soon as anyone in the household is checked as attending on the Members step, it does not wait for everyone to be accounted for."
        ],
        "related": [
          [
            "guests",
            "tracking-each-person-s-attendance"
          ],
          [
            "seating",
            "seating-setup"
          ]
        ]
      },
      {
        "id": "tracking-each-person-s-attendance",
        "title": "Tracking each person's attendance",
        "summary": "Mark who is coming to each sub-event, person by person.",
        "body": [
          "Tier 2 (person): which specific people are confirmed to attend a sub-event the household is invited to? Set these as real answers come in using the Attending Sub-Events control on each person -- click a sub-event to cycle TBD → Yes → No.",
          "TBD means not yet confirmed either way; No is a real, explicit decline for that one specific person, independent of what the rest of their household is doing.",
          "Each household row in the Guests tab list shows a chip only when there's something worth noting: a confirmed RSVP Yes or RSVP No (marked with a checkmark or X), or any opt-in-only sub-event regardless of status -- a default-all sub-event still sitting at its ordinary Invited or Pending status stays hidden, since that's the same non-answer as every other household.",
          "Wraps onto additional lines below the row when there are several, with a '+N more' toggle if there are more than four.",
          "Use the More Filters control next to the search bar (a Sub-Events sheet on mobile) to pick one or more sub-events and narrow the list to households at a particular status for any of them, e.g. everyone still pending on the Rehearsal Dinner."
        ]
      },
      {
        "id": "where-sub-event-attendance-shows-up",
        "title": "Where sub-event attendance shows up",
        "summary": "Seating, favors, Overview and the Print Brief use it.",
        "body": [
          "Per-person attendance flows automatically to seating (only people confirmed Yes for the selected sub-event appear unseated) and favors (Attending reflects each person's own Yes/No/TBD status directly).",
          "The Overview tab timeline cards show invited and confirmed counts for each sub-event at a glance, each split into adults and kids (based on the Adult or Child setting on each person), so you can answer how many adults and how many kids are coming to each event without opening the Guests tab.",
          "Once guests are tracked one by one, each card also shows how many are still awaiting an answer, with an i button that explains the count and a link that opens the Guests tab already filtered to those guests.",
          "The Print Brief includes a detailed Sub-Event Attendance section with Invited, Confirmed, Declined, and Awaiting figures (each with an adult/kid breakdown) for caterer and venue reference, plus a list naming the guests who still need to answer once guests are tracked one by one."
        ]
      },
      {
        "id": "finding-who-still-needs-to-answer",
        "title": "Finding who still needs to answer",
        "summary": "See households and guests who have not replied.",
        "body": [
          "The banner at the top of the Guests tab reports households that have not responded and, once you track guests one by one for two or more sub-events, guests whose own answer for a sub-event is still TBD, even when their household has already said Yes. Choose Show them to filter the list to exactly those guests.",
          "A panel names each guest, their household and its RSVP status, and the sub-events still open, and tapping a name opens that household. Inside an opened household, a guest who is Yes for one sub-event and unanswered for another shows a TBD tag for the open one. Choose Clear filter to return to the full list.",
          "The sub-event cards on the Overview tab and the What Needs You Next panel point to the same guests, and the Print Brief lists them. Events that only track households are not affected, because guests are not marked one by one there."
        ]
      },
      {
        "id": "attending-count-override",
        "title": "Attending count override",
        "summary": "Set a headcount that differs from the people listed.",
        "body": [
          "The Details tab of a household has an Attending Count Override for Adults and Kids, separate from the per-person Attending Sub-Events control.",
          "Set the override only when the real attending count is smaller than what SimchaKit would otherwise compute -- for example, the household RSVP'd Yes and every member is invited, but only some of them are actually able to make it and you don't want to track that person-by-person.",
          "Once set, the override always wins for that field, adults and kids independently, and stays in effect until cleared."
        ],
        "tip": "Leave it blank (the default) and SimchaKit computes the attending headcount for you: it counts each person marked Yes for the main event once anyone in the household has a Yes or No for it, or the household's full member count if nobody has answered yet, so a household that already RSVP'd Yes never reports zero attendees just because the per-person status was never walked through."
      },
      {
        "id": "bulk-rsvp-update",
        "title": "Bulk RSVP update",
        "summary": "Change the RSVP status of many households at once.",
        "steps": [
          "Select multiple households at once using the checkboxes on each row.",
          "Once households are selected, a blue action bar appears above the list where you can choose a new RSVP status and click Apply to update all selected households in one action."
        ],
        "body": [
          "A select-all checkbox in the filter bar selects all currently visible households — useful when filtering by group or status first."
        ]
      },
      {
        "id": "save-the-dates-invitations",
        "title": "Save-the-dates & invitations",
        "summary": "Track what has been mailed to each household.",
        "body": [
          "Mark each household when a save-the-date or invitation has been mailed using the checkboxes in the household row. The stat cards track completion progress across the full list."
        ]
      },
      {
        "id": "out-of-town-guests",
        "title": "Out-of-town guests",
        "summary": "Flag households that are traveling.",
        "body": [
          "Flag households as out-of-town to track them in the Stay & Travel tab. The 🧳 filter in the Guests tab shows only out-of-town households. Out-of-town count appears in the stat grid."
        ]
      },
      {
        "id": "catering-summary",
        "title": "Catering Summary",
        "summary": "A headcount for each meal, ready for your caterer.",
        "body": [
          "The collapsible Catering Summary card sits between the stat grid and filters.",
          "Once one or more timeline sub-events are flagged Meal served at this sub-event (Admin Mode → Timeline), the card builds a separate confirmed/kosher/meal-choice breakout for each one, useful when an event has more than one catering moment (e.g. Friday night dinner, Sunday brunch, the reception), since each is often a different vendor with its own headcount."
        ],
        "related": [
          [
            "admin",
            "timeline"
          ]
        ]
      },
      {
        "id": "how-the-catering-summary-counts",
        "title": "How the Catering Summary counts",
        "summary": "Confirmed, Expected and Awaiting, without double counting.",
        "body": [
          "The top-of-card Confirmed, Expected, and Awaiting numbers are a deduped count across every flagged sub-event, so a guest attending two of them is only counted once. Expected is confirmed plus awaiting, with guests who declined left out, and is the headcount to give a venue. Tap the small i on a tile to see how it is counted.",
          "Guests who declined every meal-serving sub-event, or weren't invited to any, drop out of the counts entirely rather than showing as pending."
        ]
      },
      {
        "id": "dietary-list-and-copying-for-the-caterer",
        "title": "Dietary list and copying for the caterer",
        "summary": "One dietary list, and a copy button for each vendor.",
        "body": [
          "The Dietary Requirements list is unified across all sub-events, with each guest tagged by which sub-event(s) they're relevant for. Confirmed counts, at the top of the card and in each sub-event breakout, include an adults and kids split to help plan kids meals and seating.",
          "Until at least one sub-event is flagged, the card shows one combined total based on household RSVP status, same as before. Use 📋 Copy for caterer (all) for a combined plain-text summary, or the copy button on an individual sub-event's breakout to hand just that one to its vendor."
        ]
      },
      {
        "id": "dietary-requirements",
        "title": "Dietary requirements",
        "summary": "Record dietary needs on each person.",
        "body": [
          "Enter dietary notes on individual people records. The Catering Summary surfaces all dietary requirements once a meal-serving sub-event is flagged in Admin Mode → Timeline, tagged by which sub-event(s) each guest is Confirmed or Awaiting for; before any sub-event is flagged, it shows a single ✓ Confirmed / ? Awaiting badge based on the household RSVP status.",
          "Kosher meals are flagged separately with a boolean. The Kosher Meals stat card at the top of the Guests tab counts only guests confirmed for a meal-serving sub-event, with kosher guests still awaiting an answer shown as pending, so it matches the Catering Summary and Day-of Mode."
        ]
      },
      {
        "id": "importing-guests-from-csv",
        "title": "Importing guests from CSV",
        "summary": "Load a guest list from Evite, Google Contacts and more.",
        "steps": [
          "Use the Import button in the Guests tab to load a guest list from any CSV file — not just the SimchaKit template.",
          "After uploading, SimchaKit auto-detects your column names using fuzzy matching and skips the mapping screen when all columns resolve.",
          "If any columns can't be matched automatically, a mapping screen lets you assign them before proceeding."
        ],
        "body": [
          "SimchaKit natively supports exports from Evite (Name, Email, Phone, Status, RSVP Comment columns), online-rsvp.com (person-by-person format with Group ID), Google Contacts (Given Name, Family Name, Address 1 - Street/City/Region, etc.), WedSites, Joy, and Paperless Post. RSVP values from all supported tools are automatically mapped to SimchaKit statuses — e.g. Evite's No Reply/Viewed/Delivered/Sent all map to Invited, and Yes/No/Maybe map directly.",
          "For person-by-person exports (online-rsvp.com), rows are grouped into households by Group ID and formal names are constructed automatically (e.g. 'Julie & Jon Singer')."
        ],
        "related": [
          [
            "guests",
            "reviewing-an-import-before-you-save"
          ],
          [
            "guests",
            "households-vs-people"
          ]
        ]
      },
      {
        "id": "reviewing-an-import-before-you-save",
        "title": "Reviewing an import before you save",
        "summary": "Fix missing emails, addresses and duplicates first.",
        "steps": [
          "A review screen then shows every household that will be imported, with a count of how many are ready and how many need a look.",
          "Use Change columns to go back and remap.",
          "Use Append mode to add to your existing list, or Replace mode to start fresh."
        ],
        "body": [
          "Rows with no email (messaging needs one), no address, or a possible duplicate of a household you already have are flagged in words and can be fixed on the spot: type the missing email or address, or choose Merge to fill the blanks on the existing household instead of adding a second one (or Keep both).",
          "Nothing is saved until you choose Import N households. Download the CSV template from the import screen for a pre-formatted starting point."
        ],
        "related": [
          [
            "guests",
            "importing-guests-from-csv"
          ]
        ]
      },
      {
        "id": "messaging-your-guests",
        "title": "Messaging your guests",
        "summary": "Email Save the Dates, invitations, reminders and thank-yous.",
        "steps": [
          "Pick what you are sending (Save the Date, Invitation, RSVP reminder, Thank-you, or a custom message) and choose Send by email.",
          "Choose who gets it.",
          "Shows exactly how the first message will look (switch between Desktop and Phone width), in your event's colors and logo with a quiet line saying it was sent using SimchaKit, who will be skipped (no email, or someone who unsubscribed), and a Send test to me button that emails one sample to your own address.",
          "Confirms and sends."
        ],
        "body": [
          "Choose Message guests (or select households and choose Message in the bar that appears) to email guests from SimchaKit. SimchaKit fills in a warm default you can edit for this send; use the + buttons to drop in a household name, the event date, the venue, host names, or a gift description.",
          "The group, RSVP status, sub-event, and out-of-town filters narrow the list, and Not yet sent keeps you from messaging a household twice. Households with no email address are listed so you can type one in right there or skip them.",
          "Each email carries an unsubscribe link, replies go to the address in Sender details (your account email unless you change it), and one failed delivery never stops the rest. Only the event owner and editors can send, and archived events are read-only."
        ],
        "tip": "To avoid misuse, an event can send 5 messages a minute and to 2,000 recipients a day; if you reach that, the message tells you when to try again.",
        "related": [
          [
            "guests",
            "marking-mailings-as-sent-another-way"
          ],
          [
            "guests",
            "sent-status-and-the-messages-view"
          ],
          [
            "guests",
            "sender-details"
          ]
        ],
        "isNew": true
      },
      {
        "id": "sender-details",
        "title": "Sender details",
        "summary": "Set the sender name, reply-to address and footer.",
        "body": [
          "Open Sender details on the preview step to set the sender name guests see (the event name unless you change it), the reply-to address (your account email unless you change it), a short footer added to every message, and an optional postal address shown at the bottom of each email. Leave a field blank to use its default."
        ],
        "tip": "Only the event owner and editors can change these.",
        "related": [
          [
            "guests",
            "messaging-your-guests"
          ]
        ],
        "isNew": true
      },
      {
        "id": "marking-mailings-as-sent-another-way",
        "title": "Marking mailings as sent another way",
        "summary": "Record paper or other-platform mailings without emailing.",
        "steps": [
          "You do not have to email anything from SimchaKit.",
          "Pick the kind (Save the Date, Invitation, RSVP reminder, or Thank-you), whether it went by paper mail or another platform, and the date (today, or any earlier day).",
          "A toast offers Undo for 8 seconds."
        ],
        "body": [
          "If you mail paper invitations or use Evite, Paperless Post, a printer, or a calligrapher, choose I sent these another way instead, or use Mark as sent in the bar for selected households or inside any household. Nothing is emailed; SimchaKit just keeps the record."
        ],
        "tip": "You can mark the same household for the same kind again; the most recent entry is the one shown.",
        "related": [
          [
            "guests",
            "messaging-your-guests"
          ],
          [
            "guests",
            "sent-status-and-the-messages-view"
          ]
        ],
        "isNew": true
      },
      {
        "id": "sent-status-and-the-messages-view",
        "title": "Sent status and the Messages view",
        "summary": "Read the sent chips and review every message.",
        "body": [
          "Each household shows what has gone out as labeled chips, and every chip names its kind (Save the Date, Invitation, RSVP reminder, Thank-you) in a fixed order: Not sent, Sent by email, Sent by mail, Sent elsewhere (each with its date), Sent (manual), or Failed. Open a household to see all four kinds (Save the Date, Invitation, RSVP reminder, Thank-you).",
          "The Flags & Notes tab in the household edit window shows the same chips for reference only; the old Save the Date, Invite and Thank You checkboxes are gone, so change status with Message guests or Mark as sent. Sent (manual) is what older checkboxes became: it is unchanged, and Clear removes it (with Undo).",
          "Use the mailing status filter to list households whose Save the Date or Invitation is not sent yet; any channel counts as sent. Choose Messages at the top of the Guests tab to see every message and mailing with its date, how many households, and per-household delivery status.",
          "If an email failed for some households, open it and choose Retry failed. The STD Sent and Invites Sent cards and the guest export read the same record."
        ],
        "tip": "Every chip pairs its words with a shape, a hollow circle for not sent, a solid circle for sent, and a triangle for failed, so you never have to rely on color.",
        "related": [
          [
            "guests",
            "messaging-your-guests"
          ]
        ],
        "isNew": true
      },
      {
        "id": "the-guest-rsvp-page",
        "title": "The guest RSVP page",
        "summary": "Guests reply from a private link, with no account.",
        "body": [
          "Each household can have a private reply page at its own link (it looks like app.simcha-kit.com/r/ followed by a long code). Guests need no account.",
          "They see your event's logo and colors, who they are replying for, then answer Yes, No or Not sure for each person and sub-event, choose meals where a meal is served, confirm or update their mailing address, add a note, and add a guest if you allow it.",
          "Afterwards they get a summary with Add to calendar buttons and can change their reply with the same link until the RSVP deadline set in Admin Mode, Event Details.",
          "The Invitation and RSVP reminder messages include each household's own link (the + RSVP link button adds it to any message); it appears as a button in the email at the spot you put it. After the deadline, or once an event is archived, the page shows a friendly closed message.",
          "Treat each link as private: anyone who has it can answer for that household, and you can replace a household's link if it gets shared by mistake."
        ],
        "tip": "Replies arrive as proposals and never change your guest list until you accept them; see Reviewing RSVP replies.",
        "related": [
          [
            "guests",
            "reviewing-rsvp-replies"
          ],
          [
            "guests",
            "rsvp-reminders-and-page-settings"
          ]
        ],
        "isNew": true
      },
      {
        "id": "reviewing-rsvp-replies",
        "title": "Reviewing RSVP replies",
        "summary": "Accept or reject each reply before it changes your list.",
        "body": [
          "When a guest replies, a New replies button with a count appears at the top of the Guests tab (and a New RSVP replies item leads What Needs You Next on Overview). It opens the review queue.",
          "Each reply is a proposal shown against your current guest list: which people changed their answer for which sub-event (for example Yes to Not sure), meal, dietary and kosher changes, whether the address was confirmed or changed, any note, and any guests they added.",
          "Accept applies one reply; Accept all applies every reply except those marked Needs a look, which add someone who is not on your list and need a closer review. Reject (with an optional reason only you see) leaves the guest list alone.",
          "Accepting updates each person's sub-event answers, meals and dietary details, the mailing address, and the household's RSVP status (RSVP Yes if anyone is coming to anything, RSVP No if everyone said No to everything, Maybe if nobody is coming but someone is not sure). Not sure resets that person's answer to TBD.",
          "A guest's note is saved in the household's contact log, and new guests are added as people with no answers yet. Every accept or reject shows an Undo button for 8 seconds that puts the previous values back exactly. If a guest changes their reply after you accepted, it returns to the queue marked Updated reply."
        ],
        "tip": "Only the event owner and editors can accept or reject; viewers can read replies.",
        "related": [
          [
            "guests",
            "the-guest-rsvp-page"
          ]
        ],
        "isNew": true
      },
      {
        "id": "rsvp-reminders-and-page-settings",
        "title": "RSVP reminders and page settings",
        "summary": "Nudge households that have not replied.",
        "body": [
          "To nudge households that haven't replied, choose RSVP reminder in Message guests. The recipients start as the households still marked Invited or Pending for a sub-event they are invited to, leaving out any household that has already replied through its link (whether the reply is waiting for your review or accepted).",
          "You can untick any household, and each shows when it was last reminded; if anyone was reminded in the last 3 days you get a warning with a choice to remove them or send anyway.",
          "When an RSVP deadline is set, Overview's What Needs You Next shows how many households haven't replied and how many days are left, with a Send reminder button that opens the message with exactly those households chosen. Sending an invitation or reminder creates a private link for any household that does not have one yet.",
          "In Admin Mode, Guests, the Guest RSVP page settings let you allow guests to add people (and how many, up to 6) and decide whether guests can change their reply until the deadline; the deadline itself is the RSVP deadline in Event Details, with a button to change it."
        ],
        "related": [
          [
            "guests",
            "messaging-your-guests"
          ],
          [
            "guests",
            "the-guest-rsvp-page"
          ]
        ],
        "isNew": true
      },
      {
        "id": "exporting-guests",
        "title": "Exporting guests",
        "summary": "Four CSV and print formats for different audiences.",
        "body": [
          "The ↓ Export Guests button opens a four-option export modal. By Household exports one CSV row per household — formal name, RSVP status, headcount, address, and sub-events invited to. Best for your planner or a full reference spreadsheet.",
          "By Person exports one CSV row per individual — first name, last name, meal choice, kosher flag, dietary notes, shirt size, the table they are seated at (with the sub-event name shown when they are seated at more than one), and the sub-events each person is confirmed Yes for. Best for catering, a favors vendor, or day-of staff.",
          "Mailing / Invitations exports formal names with address fields split into separate columns (Street, City, State, Zip) — ready for mail-merge or a calligrapher. Printable View generates a print-ready HTML page grouped by family / friend group, showing members, RSVP status, headcount, and dietary flags — ideal for a day-of binder or door checklist."
        ]
      }
    ]
  },
  {
    "id": "travel",
    "group": "Guests and invitations",
    "title": "Stay & Travel",
    "color": "var(--blue)",
    "tabs": [
      "accommodations"
    ],
    "topics": [
      {
        "id": "out-of-town-tracking",
        "title": "Out-of-town tracking",
        "summary": "Track notices and travel for traveling households.",
        "body": [
          "The Stay & Travel tab shows all households flagged as out-of-town. Track whether each household has been notified about accommodations and whether they've booked. The stat cards show total out-of-town, notified, and booked counts."
        ]
      },
      {
        "id": "hotel-block-details",
        "title": "Hotel block details",
        "summary": "Show your room block details at the top of the tab.",
        "body": [
          "Configure your hotel room block in Admin Mode — hotel name, block name, phone number, and cut-off date. These details appear in the Stay & Travel header for easy reference when guests call to ask about booking."
        ]
      },
      {
        "id": "check-in-check-out",
        "title": "Check-in & check-out",
        "summary": "Record arrival and departure dates.",
        "body": [
          "Record check-in and check-out dates on each household for catering and logistics planning. The dates appear in the household row and in the accommodation detail view."
        ]
      }
    ]
  },
  {
    "id": "budget",
    "group": "Money",
    "title": "Budget",
    "color": "var(--gold)",
    "tabs": [
      "budget"
    ],
    "topics": [
      {
        "id": "tracking-expenses",
        "title": "Tracking expenses",
        "summary": "Log costs and see paid and outstanding at a glance.",
        "body": [
          "Each expense has a description, category, vendor, amount, and optional due date. Mark expenses as paid using the checkbox. The stat cards show total, paid, and outstanding at a glance. Expenses group by category in the breakdown panel."
        ]
      },
      {
        "id": "payment-schedules",
        "title": "Payment schedules",
        "summary": "Split an expense into deposits and balances.",
        "body": [
          "Any expense can carry a payment schedule instead of a single paid checkbox — for example a deposit, a 50% payment, and a balance, each with its own amount, due date, and status.",
          "Once a schedule exists, the row shows what's due next with its own Mark Paid button, so you don't have to open the schedule just to pay what's next. Catching up on several payments at once? Check off however many you've actually paid and confirm the real date for each one — nothing is ever assumed to be today.",
          "Because paid status now comes from the schedule, the Paid checkbox in the Edit Expense modal is replaced with a note once a schedule exists; use the row instead. A small circular status dot replaces the square checkbox on schedule-based expenses, since paid status there is read-only.",
          "Expenses with a payment schedule show a progress bar and a paid-of-total amount instead of the single checkbox, and the CSV export includes total, paid, and remaining amounts for every expense."
        ],
        "tip": "The \"X of Y paid\" pill next to an expense always opens the full schedule to add, edit, or remove individual payments, and never marks anything paid by itself.",
        "related": [
          [
            "budget",
            "overdue-badge"
          ],
          [
            "budget",
            "due-dates-payment-suggestions"
          ]
        ]
      },
      {
        "id": "due-dates-payment-suggestions",
        "title": "Due dates & payment suggestions",
        "summary": "Due dates feed Tasks and the Planning Calendar.",
        "body": [
          "Set a due date on any expense (or on an individual scheduled payment) to get it surfaced in the Task Suggestions panel (Tasks tab) and the Planning Calendar. Overdue and upcoming payment suggestions appear automatically — no manual task creation needed."
        ]
      },
      {
        "id": "budgeted-vs-actual",
        "title": "Budgeted vs. actual",
        "summary": "Compare an estimate with what you actually pay.",
        "body": [
          "Add an optional Budgeted ($) amount to any expense to track estimate vs. actual variance. The Est. vs. Actual stat card appears once at least one budgeted amount exists, showing total variance across all estimated items."
        ]
      },
      {
        "id": "gratuity-calculator",
        "title": "Gratuity calculator",
        "summary": "Work out tips for the vendors who expect them.",
        "body": [
          "The Gratuity Calculator (bottom of the Budget tab) auto-detects tippable vendors from your expense list. Set a tip rate (15/20/25% or custom), adjust per-vendor base amounts, and click + Add to Budget to log the tip as a new expense."
        ]
      },
      {
        "id": "budget-by-timeline",
        "title": "Budget by timeline",
        "summary": "Tag each expense with the part of the event it belongs to.",
        "body": [
          "Tag each expense with the part of the event it belongs to — Service, Kiddush, Sweet Shop Party, etc. — using the Event Section dropdown in the expense form. The section list is built from your timeline entries in Admin Mode.",
          "Once tagged, switch to 📅 By Timeline view in the Budget tab to see total, paid, and outstanding broken down per section. The section filter in the filter bar lets you isolate one part of the event at a time."
        ]
      },
      {
        "id": "expense-categories",
        "title": "Expense categories",
        "summary": "Pick from preset categories, or add your own.",
        "body": [
          "Choose from a preset list of common expense categories (Attire & Accessories, Catering & Bar, Florals & Decor, and so on) when adding or editing an expense. If none fit, choose Custom and a field appears to type your own.",
          "A custom category is saved just for that expense and automatically shows up as its own option in the category filter, but it does not get added to the preset list, so you will need to type it again for other expenses.",
          "If you find yourself using the same custom category often, let us know and we can add it as a permanent option."
        ]
      },
      {
        "id": "overdue-badge",
        "title": "Overdue badge",
        "summary": "What the Budget badge counts.",
        "body": [
          "The Budget tab badge in the navigation shows how many expenses are overdue and not yet fully paid. For an expense with a payment schedule, it looks at the due dates of the unpaid installments, the same rule as the Overdue tag on each row, so one late installment is enough.",
          "The Outstanding card at the top of the Budget tab shows the same number as \"X overdue\" beside its count of unpaid items. The What Needs You Next panel on the Overview uses the same rule, and its overdue and due-soon dollar totals count only the late or upcoming installments, not the whole remaining balance.",
          "The badge disappears when nothing is overdue. Hover over any navigation badge (or use a screen reader) to see a plain-language label for what it counts."
        ]
      }
    ]
  },
  {
    "id": "vendors",
    "group": "Money",
    "title": "Vendors",
    "color": "var(--orange)",
    "tabs": [
      "vendors"
    ],
    "topics": [
      {
        "id": "vendor-overview",
        "title": "Vendor overview",
        "summary": "The stat cards at the top and what they count.",
        "body": [
          "The stat cards at the top show Total Vendors, Confirmed (booked or paid), Total Contracted, Total Paid, and Need Follow-up. Click the Need Follow-up card to instantly filter to vendors that haven't been contacted in 60+ days or have never been contacted — click again to clear the filter."
        ]
      },
      {
        "id": "vendor-cards",
        "title": "Vendor cards",
        "summary": "What each vendor card shows.",
        "body": [
          "Each vendor card shows name, type, status, contact details, financials (contract / paid / scheduled / unscheduled balance), payment progress bar, and last contacted date. Click the vendor name or the View button to open the Quick View panel. Click ✎ to edit. Click ✕ to delete — a confirmation prompt appears first.",
          "If the vendor has notes, click the notes area to expand or collapse them."
        ]
      },
      {
        "id": "vendor-types",
        "title": "Vendor types",
        "summary": "Pick a vendor type, or choose Other.",
        "body": [
          "Choose from a preset list of common vendor types (Attire, Baker, Caterer, Florist, and so on) when adding or editing a vendor. If none fit, choose Other and a field appears to type your own — for example, Calligrapher or Rabbi Honorarium.",
          "A custom type is saved just for that vendor and automatically shows up as its own option in the type filter, but it does not get added to the preset list, so you will need to type it again for other vendors.",
          "If you find yourself using the same custom type often, let us know and we can add it as a permanent option."
        ]
      },
      {
        "id": "contract-milestones",
        "title": "Contract milestones",
        "summary": "Track headcount deadlines and delivery dates.",
        "body": [
          "Add key contract dates as milestones on each vendor — headcount deadlines, asset submission windows, delivery dates. Milestones appear in the Quick View with proximity badges (green > 30 days, amber ≤ 30 days, red overdue). Milestones within 60 days generate Task Suggestions automatically."
        ]
      },
      {
        "id": "linking-expenses",
        "title": "Linking expenses",
        "summary": "Connect Budget expenses to a vendor.",
        "body": [
          "Link Budget expenses to a vendor by selecting the vendor name when creating the expense. Linked expenses feed the vendor's financial progress bar and are excluded from the unscheduled balance suggestion."
        ]
      },
      {
        "id": "contract-vs-billed-in-budget",
        "title": "Contract vs. Billed in Budget",
        "summary": "Why the two amounts can differ.",
        "body": [
          "The Contract amount is whatever you typed in when you set up the vendor, and it doesn't update on its own. If you link a new expense to that vendor afterward, for example a last-minute add-on, the vendor card shows a Billed in Budget line with the live total of everything linked in the Budget tab, plus a Sync button.",
          "Sync asks you to confirm before changing anything and records the update in the Activity Log."
        ]
      },
      {
        "id": "contract-link",
        "title": "Contract link",
        "summary": "Keep a shared contract link on the vendor.",
        "body": [
          "Paste a Dropbox, Google Drive, or any shared link in the Contract Link field. A 📄 View Contract button appears in the Quick View, making it easy to pull up the signed agreement."
        ]
      },
      {
        "id": "contact-log",
        "title": "Contact log",
        "summary": "Record every call, email and meeting.",
        "body": [
          "Record every interaction with a vendor — calls, emails, meetings, in-person visits, and contract signings — using the Contact Log section in the vendor edit form. Each entry has a date, type badge, and free-text notes.",
          "Entries are shown in the Quick View sorted most-recent first, giving you an instant answer to 'when did I last talk to them and what did we discuss?'"
        ]
      }
    ]
  },
  {
    "id": "tasks",
    "group": "Plan",
    "title": "Tasks",
    "color": "var(--blue)",
    "tabs": [
      "tasks"
    ],
    "topics": [
      {
        "id": "manual-tasks",
        "title": "Manual tasks",
        "summary": "Add your own tasks and check them off.",
        "body": [
          "Add tasks with a title, due date, category, and priority. Check them off as you complete them. The stat cards show Total Tasks, Completed (with % done), Overdue, and Due This Week at a glance. The Task Insights panel (below stat cards) provides collapsible charts: a completion progress bar and breakdowns by category and priority for incomplete tasks.",
          "Overdue tasks are flagged with ⚠ in red. The Tasks tab badge in the nav shows the count of incomplete tasks."
        ]
      },
      {
        "id": "smart-tasks",
        "title": "Smart Tasks",
        "summary": "Generate planning milestones from your event date.",
        "body": [
          "Click ✨ Smart Tasks (visible when your main event has a date set) to generate a personalized list of planning milestones with calculated due dates. SimchaKit automatically calculates when each milestone should happen based on your event date — save-the-dates 12 months before, invitations 10 weeks before, final guest count 2 weeks before, and so on.",
          "Milestones specific to mitzvahs (Torah tutoring, cantor sessions, kippot order, montage submission) or weddings (dress fitting, marriage license, menu tasting) appear only for the relevant event type. Tier 1 and 2 milestones are pre-checked; optional Tier 3 items are unchecked by default. Tasks already in your list are grayed out and marked as already covered.",
          "Past-due milestones are shown dimmed so you can see what may have been missed. Use Select all / Deselect all per group to batch-manage selections, then click Add Tasks to insert them all at once."
        ],
        "tip": "Running Smart Tasks again is safe — already-covered items are never duplicated."
      },
      {
        "id": "smart-suggestions",
        "title": "Smart suggestions",
        "summary": "Action items drawn from your own data.",
        "body": [
          "The Suggestions panel (top of the Tasks tab) automatically surfaces action items derived from your data — unpaid expenses with due dates, vendors with unscheduled balances, vendor milestones within 60 days, prep items with upcoming target dates, missing guest addresses, RSVP deadline countdowns, and seating (confirmed guests who still need a table, and tables that are over capacity).",
          "Dismiss suggestions you don't need. Suggestions linked to a specific record show a → View button — tapping it navigates directly to the source tab and highlights the matching record."
        ]
      },
      {
        "id": "categories",
        "title": "Categories",
        "summary": "Filter tasks by category.",
        "body": [
          "Tasks and suggestions are organized by category (Vendor, Budget, Planning, Guests, etc.) for easy filtering. The category filter in the filter bar lets you focus on one area at a time."
        ]
      },
      {
        "id": "sorting-and-grouping",
        "title": "Sorting and grouping",
        "summary": "Sort by due date, priority, category or name.",
        "body": [
          "Use the Sort dropdown to sort tasks by Due date, Priority, Category, or A–Z. When sorting by Due date or Category with no active search or filter, tasks are automatically grouped under category headers — making it easy to scan what's outstanding in each planning area at a glance. Completed tasks always float to the bottom regardless of sort."
        ]
      },
      {
        "id": "linked-task-completion",
        "title": "Linked task completion",
        "summary": "Tasks tied to an expense or prep item.",
        "body": [
          "Some tasks are linked to a specific budget expense or prep item — for example, a task automatically created when a payment due date is set. When you check off a linked task, a prompt asks whether you also want to mark the linked expense as paid or the prep item as Complete.",
          "Choose 'Complete Task Only' to check off just the task, or the primary button to update both records at once."
        ]
      }
    ]
  },
  {
    "id": "prep",
    "group": "Plan",
    "title": "Prep",
    "color": "var(--green)",
    "tabs": [
      "prep"
    ],
    "topics": [
      {
        "id": "preparation-items",
        "title": "Preparation items",
        "summary": "Track the honoree's preparation, item by item.",
        "body": [
          "The Prep tab tracks the honoree's preparation journey: Torah and Haftarah study, d'var Torah writing, service prayers, mitzvah project, and custom items. Items are grouped by category with a header and item count. Each item has a status (Not Started, In Progress, Nearly Done, Complete), which you set from the dropdown on the item card or in the edit window.",
          "The progress bar fills automatically from the status, so the two always agree. The Overall Progress bar at the top averages progress across all items. For bar and bat mitzvah events, an empty Prep tab offers a Load Template button that adds the standard starter items in one click.",
          "Set a target date on any item and the tab flags it if it falls behind: items past their date show Behind, and items due within 14 days show Due soon. The stat cards show Total Items, Complete, In Progress, and Not Started."
        ]
      },
      {
        "id": "target-dates",
        "title": "Target dates",
        "summary": "Put prep items on the calendar and in suggestions.",
        "body": [
          "Set a target date on any prep item to surface it in the Planning Calendar and Task Suggestions. Prep items with target dates are shown in the calendar unless a task already covers them (deduplication). Once Complete, they no longer generate suggestions."
        ]
      },
      {
        "id": "tutor-session-notes",
        "title": "Tutor & session notes",
        "summary": "Keep tutor feedback and practice notes together.",
        "body": [
          "The notes field on each prep item is a good place to track tutor feedback, session dates, and practice schedules. Notes are collapsed by default — click Notes on any item card to expand, and ▴ hide notes to collapse. Notes also appear in the calendar popover for prep items with target dates."
        ]
      },
      {
        "id": "clergy-tutor-contacts",
        "title": "Clergy & Tutor contacts",
        "summary": "Quick contact cards for Rabbi, Cantor and Tutor.",
        "body": [
          "The Clergy & Tutor section at the top of the Prep tab shows quick-reference contact cards for Rabbi, Cantor, and Tutor. For B'nei Mitzvah events, all three contacts are shown. For other event types, only the Rabbi is shown unless added manually. The email address is a clickable mailto link.",
          "Event owners and Ritual Coordinators can edit clergy contacts directly from the Prep tab by clicking the pencil icon on any card, or by clicking + Add to create a new contact. Editors and Viewers see the contact cards as read-only. Changes made here update the same data that appears in Admin Mode."
        ]
      }
    ]
  },
  {
    "id": "calendar",
    "group": "Plan",
    "title": "Planning Calendar",
    "color": "var(--accent-primary)",
    "tabs": [
      "calendar"
    ],
    "topics": [
      {
        "id": "what-appears-on-the-calendar",
        "title": "What appears on the calendar",
        "summary": "The five sources the calendar pulls together.",
        "body": [
          "The Planning Calendar aggregates five sources: your event timeline (from Admin Mode), tasks with due dates, unpaid expenses with due dates, vendor contract milestones, and prep items with target dates. Each source has its own color — rose for events, blue for tasks, gold for payments, orange for milestones, green for prep."
        ]
      },
      {
        "id": "deduplication",
        "title": "Deduplication",
        "summary": "How duplicate deadlines are avoided.",
        "body": [
          "If a task already covers a vendor milestone or prep item (by title match), the milestone or prep entry is suppressed — no duplicate deadlines. If no task covers it yet, the entry still appears so nothing falls through the cracks."
        ]
      },
      {
        "id": "list-vs-month-view",
        "title": "List vs. month view",
        "summary": "Switch between a list and a month grid.",
        "body": [
          "Toggle between ☰ List and 📅 Month views using the control in the filter bar. List view groups events by month with full detail. Month view shows a 7-column grid with color-coded chips per day. On mobile, the app automatically switches to list view."
        ]
      },
      {
        "id": "click-popover-navigation",
        "title": "Click popover & navigation",
        "summary": "Open an event's details or jump to its tab.",
        "body": [
          "Click any event in either view to open a detail popover with full title, date, source, and meta. The → [Tab] button navigates directly to the source tab and highlights the originating row."
        ]
      },
      {
        "id": "filters",
        "title": "Filters",
        "summary": "Show one kind of event, or completed tasks.",
        "body": [
          "Use the source filter to show only one category (Events, Tasks, Payments, Milestones, or Prep). The Show Completed toggle reveals completed tasks and paid expenses, hidden by default."
        ]
      },
      {
        "id": "export-to-calendar-app-ics",
        "title": "Export to calendar app (.ics)",
        "summary": "Download the calendar for Google, Apple or Outlook.",
        "body": [
          "Click ⬇ .ics in the filter bar to download all calendar events as a standard .ics file. Import it into Google Calendar, Apple Calendar, Outlook, or any other calendar app. The file includes all visible events based on your current source filter and Show Completed setting."
        ]
      }
    ]
  },
  {
    "id": "ceremony",
    "group": "Event day",
    "title": "Ceremony Roles",
    "color": "var(--blue)",
    "tabs": [
      "ceremony"
    ],
    "topics": [
      {
        "id": "what-ceremony-roles-tracks",
        "title": "What Ceremony Roles tracks",
        "summary": "Who fills each honor or role at the ceremony.",
        "body": [
          "The Ceremony Roles tab tracks who will fill each honor or role during the service or ceremony. For B'nei Mitzvah events: Aliyot, Hagbah, Gelilah, Opening and Returning Ark, English readings, and service participation. For weddings: officiant, wedding party, readers, candle lighters, and Ketubah witnesses.",
          "Each role has an assignee, an optional Hebrew name, and a notes field for instructions or requirements. Unassigned roles are highlighted with a gold left border so you can spot gaps at a glance."
        ]
      },
      {
        "id": "loading-a-template",
        "title": "Loading a template",
        "summary": "Start from a ready-made list of roles.",
        "steps": [
          "When the tab is empty, click Load Template to pre-populate roles based on your event type."
        ],
        "body": [
          "Bar/Bat/B'nei Mitzvah events get a full Torah service role list. Wedding events get a wedding party and ceremony role list. You can add, edit, reorder, or remove any role after loading the template."
        ],
        "tip": "Use Reset to Template at the bottom of the tab to start over."
      },
      {
        "id": "sections",
        "title": "Sections",
        "summary": "Group roles into named sections.",
        "body": [
          "Roles are organized into named sections (e.g. Torah Service, English Readings, Wedding Party). When adding or editing a role, type a section name or pick from the list of existing sections. Sections group roles visually and appear as collapsible headers in the Day-of overlay. Each section header shows how many roles are assigned out of the total."
        ]
      },
      {
        "id": "reordering-roles",
        "title": "Reordering roles",
        "summary": "Drag a role, or use the arrows.",
        "body": [
          "Drag the grip handle on the left of any role to move it within its section. On mobile, hold the grip for a moment before dragging. You can also use the up/down arrow buttons on the right side of each role. The sort order is saved automatically and preserved across devices, in the Day-of overlay, and in the Print Brief."
        ]
      },
      {
        "id": "reordering-sections",
        "title": "Reordering sections",
        "summary": "Move a whole section up or down.",
        "body": [
          "Drag the grip handle on a section header to move the entire section up or down. You can also use the up/down arrow buttons on the right side of the section header. This is useful when you add a new section and need to place it in service order."
        ]
      },
      {
        "id": "hebrew-names",
        "title": "Hebrew names",
        "summary": "How to enter a Hebrew name for an aliyah.",
        "body": [
          "The Hebrew name field is always available for any role. For Aliyot, the format is: First name + ben (son of) or bat (daughter of) + father's Hebrew name + v' + mother's Hebrew name. Example: Yosef ben Avraham v'Sarah."
        ]
      },
      {
        "id": "day-of-and-print-brief",
        "title": "Day-of and Print Brief",
        "summary": "Roles appear in Day-of Mode and the Print Brief.",
        "body": [
          "Ceremony Roles appear in the Day-of overlay as a read-only reference section grouped by section header, useful at the venue on the day. They also appear in the Print Brief so you can share the full event summary with your rabbi, cantor, or officiant."
        ]
      }
    ]
  },
  {
    "id": "seating",
    "group": "Event day",
    "title": "Seating",
    "color": "var(--accent-primary)",
    "tabs": [
      "seating"
    ],
    "topics": [
      {
        "id": "auto-seat",
        "title": "Auto-Seat",
        "summary": "Seat every unseated guest in one step.",
        "body": [
          "Click ✨ Auto-Seat (visible when there are unseated guests and tables configured) to automatically assign all unseated guests to tables. SimchaKit uses a First Fit Decreasing algorithm that keeps households together where possible. If kids tables exist, adults are routed to adult tables and kids to kids tables automatically.",
          "After running, a summary shows how many guests were seated, any households that had to be split across tables due to capacity, and any guests who could not be placed. All assignments can be adjusted manually after auto-seat runs."
        ],
        "tip": "Guests already assigned to tables are never moved.",
        "related": [
          [
            "seating",
            "creating-tables"
          ],
          [
            "seating",
            "assigning-guests"
          ]
        ]
      },
      {
        "id": "seating-setup",
        "title": "Seating Setup",
        "summary": "Turn on assigned seating for chosen sub-events.",
        "steps": [
          "Open the Seating Setup panel at the top of the tab and check 'This event has assigned seating'.",
          "Then select which sub-events have assigned seating using the checklist — each sub-event gets its own independent set of tables and assignments."
        ],
        "body": [
          "Only sub-events you enable will appear. The setup is saved and persists across sessions."
        ]
      },
      {
        "id": "switching-between-sub-events",
        "title": "Switching between sub-events",
        "summary": "Each sub-event has its own tables.",
        "body": [
          "When two or more sub-events have seating enabled, a pill switcher appears above the stat cards. Click a pill to switch to that sub-event's seating chart. Tables, assignments, and the unseated panel all update to show only that sub-event's data. Each sub-event is completely independent — adding a table or assigning a guest only affects the active sub-event."
        ]
      },
      {
        "id": "creating-tables",
        "title": "Creating tables",
        "summary": "Add tables with a name, capacity and type.",
        "body": [
          "Add tables with a name, capacity, and type (Adult / Kids / Mixed). Tables are created for the currently active sub-event and only appear in that sub-event's chart. Reorder tables with the ↑ ↓ buttons."
        ],
        "related": [
          [
            "seating",
            "auto-seat"
          ]
        ]
      },
      {
        "id": "assigning-guests",
        "title": "Assigning guests",
        "summary": "Seat people from the unseated panel.",
        "steps": [
          "Select a person from the unseated panel then click a table to assign them, or use Manage Assignments on any table card for bulk assignment."
        ],
        "body": [
          "The unseated panel shows only people confirmed for the active sub-event."
        ],
        "tip": "Assignments are scoped to the active sub-event — a person can be at a different table for the Kiddush than for the Evening Party."
      },
      {
        "id": "tbd-attendees",
        "title": "TBD attendees",
        "summary": "Why unconfirmed guests are not in the unseated list.",
        "body": [
          "People whose sub-event attendance is not yet confirmed (TBD) are excluded from the unseated panel and shown as a count below the Unseated header. They cannot be newly seated until their attendance is confirmed in the Guests tab.",
          "If someone already seated has their attendance changed to TBD or No after being assigned, whether at the household level or their own individual sub-event status, a small Declined or TBD tag appears right next to their name on the table card and in Manage Assignments, so the change is visible on the chart itself instead of only showing up later when you export or print.",
          "They stay in their seat until you remove them; the tag is a heads-up, not an automatic removal. Table exports, By Table and By Person alike, always exclude anyone not confirmed Yes for the active sub-event, regardless of what the on-screen chart shows."
        ]
      },
      {
        "id": "adult-and-kid-counts",
        "title": "Adult and kid counts",
        "summary": "See the adults and kids split on the stat cards.",
        "body": [
          "The Seated and Unseated stat cards show an adults and kids split, based on the Adult or Child setting on each person. Use it to tell at a glance whether you need another Kids table or more adult seats. The split covers the same people each card already counts: only guests confirmed for the active sub-event.",
          "Tap the small i beside Seated or Unseated to see exactly who each one counts."
        ]
      },
      {
        "id": "seating-gap-warning",
        "title": "Seating gap warning",
        "summary": "A heads-up when seats run short.",
        "body": [
          "When the total seat capacity for a sub-event is less than the number of guests whose own answer for it is Yes, the gap is surfaced in the 'What Needs You Next' focus panel on the Overview tab. Clicking the row navigates directly to the Seating tab."
        ]
      },
      {
        "id": "capacity-meter",
        "title": "Capacity meter",
        "summary": "Seat demand against supply, at a glance.",
        "body": [
          "A visual meter below the stat cards shows seat demand vs. supply at a glance. The bar fills based on the ratio of confirmed guests to total seats: green when under 90%, gold between 90% and 100%, red when confirmed guests exceed available seats. A red callout appears when more seats are needed.",
          "A secondary line below shows how many confirmed guests are currently assigned to tables. The meter is per-section aware and updates when you switch sub-events."
        ]
      },
      {
        "id": "exporting-the-seating-chart",
        "title": "Exporting the seating chart",
        "summary": "Three export formats for the active sub-event.",
        "body": [
          "Use the ↓ Export Seating button (visible once seating is configured and tables exist) to export the active sub-event's chart in three formats. By Table exports a CSV with tables as columns and names listed underneath — best for venue staff and day-of binders.",
          "By Person exports a CSV with one row per person including their table, household, group, and meal choice — best for catering and planning. Printable View generates a print-ready HTML page grouped by table — the title includes the sub-event name for clarity."
        ]
      }
    ]
  },
  {
    "id": "gifts",
    "group": "Event day",
    "title": "Gifts",
    "color": "var(--green)",
    "tabs": [
      "gifts"
    ],
    "topics": [
      {
        "id": "recording-gifts",
        "title": "Recording gifts",
        "summary": "Log each gift, and several gifts from one giver.",
        "body": [
          "Log each gift with the giver's name, then the gift itself: its type, amount, and description. If a giver sent more than one gift, such as a check and a book set, choose + Add another gift to list each one in the same record, each with its own type, amount, and description. A gift row left blank is ignored.",
          "The date received, whether the donor attended, and notes apply to the whole record. If the name matches a household in your guest list, the record links automatically and pulls in their address, so no manual entry is needed. For donors not on your guest list, enter their address manually for use in thank-you exports.",
          "A record whose gifts have different types shows as Combination in exports.",
          "The stat cards show Total Gifts (each gift counts once, so a check and a book set from one family count as two, and the card notes how many entries they came from), Total Monetary Value (every gift with an amount), Cash / Check Total (only gifts typed Cash / Check, even inside a record that has other gifts), Thank Yous Outstanding (givers whose note is not yet both written and mailed), and Thank Yous Complete (givers with both steps done)."
        ],
        "isNew": true
      },
      {
        "id": "thank-you-tracking",
        "title": "Thank-you tracking",
        "summary": "Track Written and Mailed for each giver.",
        "body": [
          "Each giver tracks two independent thank-you steps: Written (the note has been written) and Mailed (the note has been sent). A giver who sent several gifts in one record needs just one note, so the steps are tracked once per giver, not once per gift.",
          "Toggle each step with the labeled Written and Mailed buttons next to each giver's name in the Thank-you note column. Filter by Needs Written, Written Needs Mailed, or Complete to work through your list in order. Click the Amount or Received column headers to sort by that column; the default order is most recent date received, then last name.",
          "Edit stays a visible pencil icon on each row, and Delete sits inside the ⋯ menu next to it, with a confirmation step before anything is removed."
        ],
        "isNew": true
      },
      {
        "id": "emailing-thank-yous",
        "title": "Emailing thank-yous from a gift",
        "summary": "Draft a thank-you email for a giver, or for several at once.",
        "body": [
          "On the Gifts tab, choose Draft thank-you beside a giver in the Thank-you message column (on a phone, under their Written and Mailed buttons). The message opens already set to the Thank-you wording, with the giver's household name and the gift filled in for you. You can edit the words before sending.",
          "To do several at once, tick the box beside each giver whose note is not written yet, then choose Draft thank-you in the bar that appears. Each giver's household gets its own email with its own gift, and a gift given by two households sends two emails.",
          "When an email goes out, that giver's Written step is set for you and the message is recorded in Messages under Guests. Mailed is never set automatically; if you also send a paper card, choose Mark mailed in the message that appears after sending, or use the Mailed button on the row. If a send fails, nothing changes for that giver.",
          "A giver whose household has no email shows No email, add one: choose it to type the address in the message, which saves it on the guest. A giver who is not linked to the guest list has no email to use, so use Mark written (paper) once you have written the note by hand. Only the event owner and editors can send; archived events are read-only."
        ],
        "isNew": true
      },
      {
        "id": "thank-you-counts-and-badges",
        "title": "Thank-you counts and badges",
        "summary": "What the stat cards and badges count.",
        "body": [
          "The Thank Yous Outstanding stat card counts givers whose note is not yet both written and mailed, and its sub-line splits that into how many are still to write and how many are written but still to mail.",
          "The Thank Yous Complete card counts givers with both steps done, so the two cards always add up to every giver on the list. Once the event date has passed, the Gifts tab badge in the navigation and the thank-you item on the Overview show the same outstanding count, and they disappear when every note is done.",
          "On a phone, each gift card shows every giver's full name and the same Written and Mailed buttons; tap the arrow on the card to see each gift in the record, the date received, and whether the donor attended, and tap the menu button for Edit or Delete."
        ],
        "isNew": true
      },
      {
        "id": "exporting-gifts",
        "title": "Exporting gifts",
        "summary": "CSV and print formats for thank-you work.",
        "body": [
          "Click ↓ Export to open the export modal. CSV Export generates one row per giver sorted by last name, including address, amounts, and thank-you status, ready to paste into Excel. When a record holds several gifts, they share one row: the Gift Type reads Combination if the types differ, the Description lists each gift, and the Amount is the total.",
          "Printable View opens print options: sort by surname, date received or type; include addresses; group by type, with a subtotal for each; only gifts without a thank-you written; and show attendance. It then prints one compact table with a row per giver, Written and Mailed boxes to tick off by hand (already-done steps print with a check mark), the amount and date received, and a footer with Page X of Y. The last page ends with totals by type and the total monetary value, which match the Gifts tab. It prints on Letter, or A4 outside the US, Canada and Mexico."
        ]
      }
    ]
  },
  {
    "id": "favors",
    "group": "Event day",
    "title": "Favors",
    "color": "var(--gold)",
    "tabs": [
      "favors"
    ],
    "topics": [
      {
        "id": "favor-setup",
        "title": "Favor Setup",
        "summary": "Turn on favors and set up the types you give.",
        "body": [
          "The ⚙ Favor Setup card at the top of the tab controls all favor types. Check Are you giving out favors? to activate tracking.",
          "Each favor type has its own config block: what the favor is (e.g., Sweatshirts), who receives one (All guests, All kids, All adults, or Select manually), whether sizing is needed, whether favors are personalized, and which sub-event the favors are distributed at.",
          "Use + Add Another Favor Type to track multiple favors for different sub-events — for example, sweatshirts at the Evening Party and water bottles at the Kiddush. Each type is fully independent. Click Save Settings to apply. The setup card collapses once saved — click the header to expand and edit at any time."
        ]
      },
      {
        "id": "available-panel",
        "title": "Available panel",
        "summary": "Guests who have not been added to favors yet.",
        "body": [
          "The right-hand panel shows everyone from your guest list who has not been added to favors yet. The panel automatically filters to match your Who receives a favor? setting.",
          "Click any person to add them instantly — their size is pulled from their guest record and stays in sync with it, so updating their Shirt Size or Pant Size later on the Guests tab updates their favor entry automatically. Use the search and group filter to find specific people quickly."
        ]
      },
      {
        "id": "favor-list-and-inline-editing",
        "title": "Favor list and inline editing",
        "summary": "Edit recipients right in the list.",
        "body": [
          "The left panel shows all current favor recipients. Columns shown depend on your setup — Size appears when sizing is on, Name on Favor and Pre-Printed appear when personalization is on, Attending appears when a sub-event is linked. Click the Pre-Printed value on any row to cycle through TBD → Yes → No without opening a modal.",
          "For any recipient linked to your guest list, Size and Attending are both derived automatically — Size from the person's Shirt/Pant Size, and Attending from that person's own Yes/No/TBD sub-event status — edit either one on the Guests tab.",
          "Only a favor type set to \"Don't pre-fill — enter manually\", or a recipient typed in without matching a guest, keeps an editable Size field."
        ]
      },
      {
        "id": "size-and-category-breakdown",
        "title": "Size and category breakdown",
        "summary": "Counts to copy onto a vendor order form.",
        "body": [
          "When sizing is enabled, a Size Summary card shows counts per size code — useful for vendor order forms. A By Category card shows counts by category and is clickable to filter the list. Both update live as you add or edit recipients."
        ]
      },
      {
        "id": "export",
        "title": "Export",
        "summary": "Send a recipient list to your vendor.",
        "body": [
          "Use the ↓ Export button to open the export modal. CSV Export generates one row per person sorted by last name — ready to send to your vendor. Printable View generates a print-ready distribution checklist grouped by size (when sizing is on) or alphabetically."
        ]
      }
    ]
  },
  {
    "id": "search",
    "group": "Tools",
    "title": "Search",
    "color": "var(--blue)",
    "topics": [
      {
        "id": "opening-search",
        "title": "Opening search",
        "summary": "Press Command-K or Ctrl-K from anywhere.",
        "body": [
          "Press ⌘K (Mac) or Ctrl+K (Windows/Linux) to open the global search overlay from anywhere in the app. You can also click the search button in the top bar. Close with Escape or by clicking the backdrop."
        ]
      },
      {
        "id": "what-s-searchable",
        "title": "What's searchable",
        "summary": "Everything search looks through.",
        "body": [
          "Search covers all 9 collections: Guests (households and individual people), Vendors, Expenses, Tasks, Prep, Gifts, Favors, and Calendar events. Results are grouped by collection with up to 4 results shown — click Show all to expand any group."
        ]
      },
      {
        "id": "navigating-to-results",
        "title": "Navigating to results",
        "summary": "Jump to a result and see it highlighted.",
        "body": [
          "Clicking a result navigates to the source tab and highlights the matching row with an amber glow. For guest people results, the app scrolls to the household card and expands it. Calendar results navigate to the Calendar tab."
        ]
      }
    ]
  },
  {
    "id": "admin",
    "group": "Tools",
    "title": "Admin Mode",
    "color": "var(--orange)",
    "topics": [
      {
        "id": "navigating-admin-mode",
        "title": "Navigating Admin Mode",
        "summary": "Move between Admin Mode sections.",
        "body": [
          "Use the sidebar on the left to move between sections. On mobile the sidebar collapses to a section selector at the top of the panel. Tap it to switch sections. Changes in each section save immediately."
        ]
      },
      {
        "id": "accessing-admin-mode",
        "title": "Accessing Admin Mode",
        "summary": "Who can open it, and where.",
        "body": [
          "Click the settings gear in the sidebar footer. Admin Mode is available only to the event owner and opens immediately, no password needed. Editors, Viewers, and Ritual Coordinators see the gear button but cannot open the panel."
        ]
      },
      {
        "id": "event-details",
        "title": "Event Details",
        "summary": "Name, type, theme, RSVP deadline and catering style.",
        "body": [
          "Set the event name, type (Bar/Bat Mitzvah, Wedding, etc.), theme, RSVP URL, RSVP deadline, and catering style. The event name appears in the sidebar event switcher and in the top bar on each tab. The RSVP deadline triggers a countdown banner in the Guests tab."
        ]
      },
      {
        "id": "timeline",
        "title": "Timeline",
        "summary": "Build the sub-events that drive the whole app.",
        "body": [
          "Build the event timeline here, each entry has a title, icon, date, start/end time, venue, an Is Main Event flag, a Meal served at this sub-event flag, and an Invite all households by default setting.",
          "Leave Invite all households by default on (the default) for sub-events everyone attends; switch it off for a sub-event only a handful of households attend, like a small rehearsal or a minyan, so on the Guests tab you only need to check the few households who are invited rather than uncheck everyone who is not.",
          "Entries switched off show an Opt-in only tag in this list. An entry that has a date but no start time shows a No time set tag, and an entry with a start time but no end time shows a No end time tag, so gaps are easy to spot.",
          "Day-of Mode treats an untimed entry as all day and an entry without an end time as lasting one hour. Flag Meal served at this sub-event on any entry where food is served (a dinner, a brunch, the reception); the Catering Summary on the Guests tab builds a separate confirmed/kosher/meal-choice breakout for each entry flagged this way.",
          "Timeline entries appear on the Overview tab, the Planning Calendar, and the Print Brief."
        ],
        "tip": "Each entry can also carry a room, a venue address, a Family only setting and an Arrive by time; these feed the Overview's Celebration schedule and are never shown to guests."
      },
      {
        "id": "guest-configuration",
        "title": "Guest configuration",
        "summary": "Guest groups, meal choices and sizes.",
        "body": [
          "Customize guest groups, meal choices, and sizes in the Guests section of Admin Mode. Guest groups control the filter options and household group dropdown (e.g., Family, Friends, Sydney's Class). Meal choices drive the household meal selection and Catering Summary.",
          "Sizes (shirt & pant) use a CODE | Label format (e.g. AS | Adult Small), the code appears in the Favors size summary, the full label in dropdowns. All three lists support add, remove, reorder, and reset to defaults.",
          "An optional Kosher Meal Label field beneath Meal Choices names which meal option should auto-sync with the Kosher meal required checkbox on a person's record; leave it blank to match any meal choice containing the word kosher."
        ]
      },
      {
        "id": "hotel-block",
        "title": "Hotel block",
        "summary": "Enter your hotel block once.",
        "body": [
          "Enter hotel block details (hotel name, block name, phone, cut-off date) so they appear in the Stay & Travel tab header for easy reference."
        ]
      },
      {
        "id": "clergy-tutor",
        "title": "Clergy & Tutor",
        "summary": "Store contact details for Rabbi, Cantor and Tutor.",
        "body": [
          "Add contact details for your Rabbi, Cantor, and Tutor / Madrikh·a in Admin Mode → Clergy & Tutor. Each contact has name, phone, email, and notes fields. Cantor and Tutor are shown automatically for B'nei Mitzvah event types and hidden for others, use the '+ Add anyway' option to include them for any event type.",
          "Contacts saved here appear as a quick-reference card on the Prep tab."
        ]
      },
      {
        "id": "collaborators",
        "title": "Collaborators",
        "summary": "Invite co-planners and choose what they can do.",
        "body": [
          "Invite others to help plan this event using the Invite a co-planner button in the sidebar footer, or from the More menu on mobile. Owners can invite Editors, Viewers, or Ritual Coordinators. Editors can invite Viewers or Coordinators. Editors get full planning access: they can add guests, manage the budget, update tasks, and more.",
          "Viewers get read-only access so family members can follow along without making changes. Ritual Coordinators, such as synagogue clergy or a b'nei mitzvah tutor, can view and edit only the Ceremony and Prep tabs, so the rest of your planning stays private. Enter an email address to send an invitation. Invitations expire after 7 days.",
          "You can have up to 5 Editors and Viewers per event. Ritual Coordinators do not count toward that limit. Collaborators are covered by your purchase at no extra cost. You can also manage collaborators in Admin Mode → Collaborators, where you can view pending invitations, remove collaborators, or copy an invite link to share via message.",
          "Collaborator names and email addresses appear in the collaborator list once they have accepted. Events with active collaborators show a collaborator count badge on the event card in the event picker. When a co-planner is actively viewing the event, a green dot appears on their avatar in the sidebar.",
          "On mobile, a badge in the header shows how many co-planners are online. Presence updates automatically and clears within seconds of someone leaving."
        ]
      },
      {
        "id": "editing-at-the-same-time",
        "title": "Editing at the same time",
        "summary": "How SimchaKit protects simultaneous edits.",
        "body": [
          "If you and a co-planner edit the same item at the same time, SimchaKit protects both of you from silently losing changes. Whoever saves first gets their update applied normally. If you try to save right after them, you will see a message letting you know the item was just changed, and your screen updates to show their latest version.",
          "Your own edit is not applied on top of theirs; review the current version and make your changes again if still needed. This applies across every tab, from guest households to tasks, gifts, and seating."
        ]
      }
    ]
  },
  {
    "id": "dayof",
    "group": "Tools",
    "title": "Day-of Mode",
    "color": "var(--accent-primary)",
    "topics": [
      {
        "id": "opening-day-of-mode",
        "title": "Opening Day-of Mode",
        "summary": "A full-screen view for the day itself.",
        "steps": [
          "Click the Day-of Mode entry in the sidebar (the gold-tinted button below the navigation tabs).",
          "On mobile, open the More menu and tap Day-of Mode.",
          "Close it with the X button to return to the dashboard."
        ],
        "body": [
          "Day-of Mode opens as a full-screen overlay. In the week before your event, a gold reminder banner appears under the header on mobile, so Day-of Mode is one tap away. Dismiss it with the X and it returns the next morning."
        ],
        "tip": "On the day of the event it reads It's today and cannot be dismissed."
      },
      {
        "id": "event-timeline",
        "title": "Event Timeline",
        "summary": "Check off the schedule as the day moves.",
        "body": [
          "Your Admin Mode timeline entries appear in chronological order. Tap each row to check it off as it gets underway or completes. Checks persist across device refreshes — closing and reopening the overlay keeps your progress.",
          "An entry with a date but no start time counts as all day, and an entry with a start time but no end time counts as lasting one hour, so both still show as happening now or coming up next."
        ]
      },
      {
        "id": "hot-sheet",
        "title": "Hot Sheet",
        "summary": "Key numbers at a glance.",
        "body": [
          "Key numbers at a glance: confirmed guests, expected, adults and kids, kosher meals required, and dietary flags with confirmed/pending status.",
          "These use the same rules as the Catering Summary: once a sub-event is flagged Meal served in Admin Mode, they count guests invited to those sub-events, each guest's own Yes or No for them counts, and anyone who declined drops out, so the two screens always agree.",
          "Guests flagged Kosher meal required appear in the dietary list even without dietary notes. Until a sub-event is flagged, the numbers follow household RSVP status. Below that, all booked vendors with their contact name and a tap-to-call phone link — no digging through vendor cards needed."
        ]
      },
      {
        "id": "day-of-checklist",
        "title": "Day-of Checklist",
        "summary": "A checklist you build before the event.",
        "body": [
          "A manual checklist you build in the weeks before the event. Each item has a task description and a time block (Morning / Midday / Afternoon / Evening / Wrap-up). Items are grouped by time block so at 3 PM you only see the afternoon tasks. Add items with + Add Item directly in the overlay.",
          "Check items off by tapping the circle."
        ]
      },
      {
        "id": "notes",
        "title": "Notes",
        "summary": "A shared scratch pad that syncs on every device.",
        "body": [
          "A free-text scratch pad shared with the Overview tab Quick Notes. Anything you jot here syncs across all devices in real time — useful for logging decisions, vendor confirmations, or last-minute changes as the day unfolds."
        ]
      }
    ]
  },
  {
    "id": "activitylog",
    "group": "Tools",
    "title": "Activity Log",
    "color": "var(--blue)",
    "topics": [
      {
        "id": "what-the-activity-log-tracks",
        "title": "What the Activity Log tracks",
        "summary": "Meaningful changes across the app.",
        "body": [
          "The Activity Log records meaningful changes across the app: households added, updated, or deleted; RSVP status changes; expenses added or marked paid; vendors added or deleted; tasks completed; and gifts added. Minor edits (notes, field tweaks) are not logged to keep the history clean and readable."
        ]
      },
      {
        "id": "actor-attribution",
        "title": "Actor attribution",
        "summary": "Who made each change.",
        "body": [
          "New entries show who made the change (the actor's display name followed by the action). Legacy entries from before attribution was added show the action only, without a name."
        ]
      },
      {
        "id": "opening-the-activity-log",
        "title": "Opening the Activity Log",
        "summary": "Where to find it.",
        "body": [
          "Open the account menu in the sidebar footer and select Activity Log, or tap See all activity at the bottom of the Notifications panel. On mobile, tap More and select Activity Log. The log opens as an overlay and shows all entries newest first."
        ]
      },
      {
        "id": "filtering-entries",
        "title": "Filtering entries",
        "summary": "Show Added, Updated, Deleted or Completed.",
        "body": [
          "Use the filter buttons at the top of the overlay to show only Added, Updated, Deleted, or Completed entries. Select All to see the full history."
        ]
      },
      {
        "id": "clearing-the-log",
        "title": "Clearing the log",
        "summary": "Wipe all entries, with a confirmation.",
        "body": [
          "The Clear Log button (visible to the right of the filters) wipes all entries. A confirmation prompt appears before clearing. The button is hidden when the event is archived."
        ],
        "tip": "This action cannot be undone."
      },
      {
        "id": "archiving-and-resetting",
        "title": "Archiving and resetting",
        "summary": "What happens to the log when you archive or reset.",
        "body": [
          "When an event is archived, the Activity Log is preserved as part of the historical record and becomes read-only. When event data is reset via Admin Mode, the Activity Log is cleared along with all other collections."
        ]
      }
    ]
  },
  {
    "id": "notifications",
    "group": "Tools",
    "title": "Notifications",
    "color": "var(--accent-primary)",
    "topics": [
      {
        "id": "what-notifications-show",
        "title": "What notifications show",
        "summary": "A live count of your co-planners' activity.",
        "body": [
          "The notification bell in the top bar shows a live count of unread activity from your co-planners. Each entry shows who made the change, what they did, and when. Your own actions are excluded from the unread count."
        ]
      },
      {
        "id": "opening-the-panel",
        "title": "Opening the panel",
        "summary": "Recent activity, newest first.",
        "body": [
          "Click the bell icon in the desktop top bar or the mobile header. A dropdown panel shows recent activity newest first, with unread entries highlighted. Tap an entry to jump to the relevant tab (guests, budget, vendors, and so on). Legacy entries without a tab link are shown but not clickable."
        ]
      },
      {
        "id": "mark-all-read",
        "title": "Mark all read",
        "summary": "Clear the unread badge for yourself only.",
        "body": [
          "The Mark all read button at the top of the panel clears the unread badge. This only updates your personal read marker. It does not delete any entries or affect what other co-planners see."
        ]
      },
      {
        "id": "see-all-activity",
        "title": "See all activity",
        "summary": "Open the full Activity Log.",
        "body": [
          "At the bottom of the panel, See all activity opens the full Activity Log overlay with filtering, search, and the complete event history."
        ]
      },
      {
        "id": "solo-events",
        "title": "Solo events",
        "summary": "Why the bell stays at zero when you plan alone.",
        "body": [
          "If you are the only planner on an event, the bell will always show zero unread because your own actions are excluded. The bell still opens the panel and you can use it to review recent changes or jump to the full Activity Log."
        ]
      }
    ]
  },
  {
    "id": "tips",
    "group": "Tools",
    "title": "Tips & Shortcuts",
    "color": "var(--gold)",
    "topics": [
      {
        "id": "confirmation-toasts",
        "title": "Confirmation toasts",
        "summary": "Small messages that confirm each save.",
        "body": [
          "After any add, edit, or delete action — adding a guest, marking an expense paid, completing a task, logging a gift, and so on — a small confirmation message briefly appears at the bottom of the screen and fades away automatically. This is called a toast notification. No action is needed to dismiss it."
        ]
      },
      {
        "id": "tab-indicators",
        "title": "Tab indicators",
        "summary": "A dot on tabs that already have records.",
        "body": [
          "Tabs that contain at least one record show a small filled dot in the sidebar. This lets you see at a glance which planning areas have been started without opening each tab. The dot is suppressed on tabs that already show a numeric badge count (Budget, Tasks, Stay & Travel)."
        ]
      },
      {
        "id": "keyboard-shortcuts",
        "title": "Keyboard shortcuts",
        "summary": "Command-K for search and Escape to close.",
        "body": [
          "⌘K / Ctrl+K opens global search from anywhere. Escape closes any open modal, overlay, or the event switcher list. These are the only keyboard shortcuts currently supported — more are planned."
        ]
      },
      {
        "id": "dark-mode",
        "title": "Dark mode",
        "summary": "Switch between light, dark and system.",
        "body": [
          "Use the sun/moon/monitor toggle in the account menu (sidebar footer) to switch between light, dark, and system-following modes. On mobile, the same toggle is in the More menu. Your preference is saved to your browser."
        ]
      },
      {
        "id": "sync-offline",
        "title": "Sync & offline",
        "summary": "Live sync, and what happens offline.",
        "body": [
          "SimchaKit syncs in real time over a WebSocket connection. If you go offline, changes queue locally and sync automatically when the connection restores. The sync indicator in the top bar shows Live, Connecting, Offline, or ⏳ N pending.",
          "After any data change, the indicator updates to show when data was last saved — 'Saved just now', 'Saved 2m ago', and so on."
        ]
      },
      {
        "id": "print-brief",
        "title": "Print Brief",
        "summary": "A printable summary of your event.",
        "body": [
          "The Print brief button in the top bar generates a printable HTML summary of your event: timeline, guest counts, dietary summary, confirmed vendors with payment progress, and open tasks.",
          "The Guest Summary counts (Expected, Confirmed, Awaiting, Kids Attending, Kosher Meals) and the dietary list use the same rules as the Catering Summary and Day-of Mode, so a printout always matches what you see on screen; guests who declined are left out. The same button is also available inside Day-of Mode. Use your browser's Print to PDF to save it."
        ]
      },
      {
        "id": "getting-ready",
        "title": "Getting ready",
        "summary": "A five-step setup card at the top of Overview.",
        "body": [
          "A new event shows a Getting ready card at the top of Overview with five steps: Event created, Events and venue, Add your guests, Invite a co-planner, and Pick your color and logo. Every step shows its status as a word and a shape: Done (check), Skipped (arrow) or To do (empty circle).",
          "Skip a step to come back to it later. Progress is saved on the event, not in your browser, so co-planners see the same card and the same progress on every device. When one step is left the card shrinks to a single line; it disappears once every step is done or skipped.",
          "Dismiss hides it early, and a Getting ready button in the Overview header brings it back. Viewers see progress but cannot change it."
        ],
        "tip": "Each step opens in place and does its work there, so you never have to visit Admin: Events and venue saves a venue and lets you add another event, Add your guests opens the spreadsheet import (or takes you to the Guests tab to add one household), Invite a co-planner opens the invite window, and Pick your color and logo lets you choose a color scheme and upload a logo.",
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "creating-an-event",
        "title": "Creating an event",
        "summary": "Set up a new event on one screen.",
        "body": [
          "Creating an event is one screen: choose what you are celebrating, name it, add a date and an optional venue, and pick the events to track. A bat, bar or b'nei mitzvah suggests Service, Kiddush and Reception; a wedding suggests Ceremony and Reception; other celebrations get a sensible starting set.",
          "Tap an event to turn it off or use + Add for your own. The first one becomes the main event for the countdown, and every one is created as a sub-event, so guests can be invited and reply to each from day one. A live preview shows your countdown as you type.",
          "After your first event SimchaKit asks what to call you; Skip for now takes you straight in."
        ],
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "the-overview-hero",
        "title": "The Overview hero",
        "summary": "Your event, its Hebrew date and a countdown.",
        "body": [
          "The top of the Overview is the event itself: your logo or a monogram (the first letter of the event name), the name, the date and venue, and the Hebrew date with the parashah when the date is a Shabbat or festival.",
          "While you plan it shows a large count of days to go and a runway of the dates the app knows about: when invitations went out, the reply deadline, anything on your timeline before the celebration weekend, and the day itself, with a marker for today.",
          "On a phone the runway becomes one Next line (in the final two weeks, the next gathering's time and venue).",
          "On the day it says Today is the day, Mazel tov with your preferred name, Up next, Then and Tonight with times, and an Open Day-of Mode button; when Shabbat or a festival ends before an evening event it adds Shabbat ends and the time.",
          "After the event it says What a day and shows how many thank-you notes are left, with a Start thank-you notes button. The Hebrew date, parashah and Shabbat times come from Hebcal (hebcal.com), whose content is shared under a Creative Commons Attribution license; if Hebcal cannot be reached those lines are simply left out.",
          "The count-down animation plays once per browser session and not for visitors who prefer reduced motion. The colors are chosen from your color scheme so text stays readable in light and dark mode."
        ],
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "celebration-schedule",
        "title": "Celebration schedule",
        "summary": "Your main weekend, day by day, with times and rooms.",
        "body": [
          "Under the hero, the Celebration schedule lists the main weekend from your Timeline, grouped by day, with each start time, the name, the building and room, and the confirmed count with adults and kids for that event. Tap a row to open its details in the Calendar.",
          "Entries before the first day of the celebration (a rehearsal, weekday minyans) sit behind one Earlier dates line. In Admin Mode, Timeline, each entry can have a Room, a Venue address, a Who is this for?",
          "setting (Family only hides the count and leaves it out of the copied schedule) and an Arrive by time for family or the people running the event, for example photos before the service; none of these is ever shown to guests.",
          "Copy schedule puts plain text on your clipboard for pasting into a message: day headings, times, names, building and room, then each building's address once. On the day, finished rows read Done and the next is highlighted Up next.",
          "When the main date is Shabbat or a festival and an event starts that evening, its row says when it ends (Havdalah) if a venue address with a ZIP code is on file. After the event the schedule is hidden. On day zero it lists the events created with your event, with Add time links."
        ],
        "related": [
          [
            "admin",
            "timeline"
          ]
        ],
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "who-s-coming-and-readiness",
        "title": "Who's coming and Readiness",
        "summary": "Confirmed, declined and awaiting at a glance.",
        "body": [
          "Who's coming shows Confirmed, Declined and Awaiting guests in one bar, each with a symbol and a word, the total guests and households, and how many households are traveling in from out of town; open the i beside Confirmed to see exactly how it is counted. Counts for each event are in the schedule.",
          "Readiness shows four measures with a bar and one line of what is left: Meals chosen (out of the guests expected, counted the same way as the Catering Summary), Budget paid, Tasks done and Vendors booked. After the event, the thank-you work in the hero and in Needs you now replaces Who's coming."
        ],
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "needs-you-now",
        "title": "Needs you now",
        "summary": "What to do next, in order of urgency.",
        "body": [
          "The Overview's Needs you now card lists what needs you, in order of urgency: overdue invoices, overdue tasks, new RSVP replies, households that have not replied as the deadline nears, invoices due soon, tasks due this week, thank-you notes owed after the event, then other items such as seating gaps, unbooked vendors and households missing an address.",
          "Each row names the thing (an invoice shows what it is, the amount, the vendor and the due date; a task shows its title and due date) and has one button. The first row is featured, and it is red only when it is overdue. Only an overdue row says Overdue and how many days, with a warning triangle.",
          "Record payment opens the invoice's details with Mark paid (it is dated today; change the date in Budget if it was earlier), and Mark done completes a task on the spot. Each of these shows an Undo for 8 seconds and the row stays in place as Marked done or Marked paid until the Undo is gone.",
          "Review opens the reply queue, Send reminder opens the message with those households chosen, Write thank-yous opens the Gifts tab showing only gifts whose thank-you is not written yet, and Add address opens Guests. When nothing needs you it says You're all caught up with the next date. On day zero the Getting ready card takes this place.",
          "Owners and editors act on rows; viewers, and anyone on an archived event, only see links to read the tab."
        ],
        "related": [
          [
            "guests",
            "reviewing-rsvp-replies"
          ],
          [
            "tips",
            "getting-ready"
          ]
        ],
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "greeting-and-your-preferred-name",
        "title": "Greeting and your preferred name",
        "summary": "Choose the name the Overview greets you with.",
        "body": [
          "The Overview greets you with Welcome back, followed by the name you choose under What should we call you? in the Update your name window (open it from your account name on the events page). If you leave it empty the greeting is just Welcome back.",
          "Your display name is separate: it is what co-planners and guests see on invitations and messages, so you can set it to something like The Brook Family without being greeted that way."
        ],
        "isNew": true,
        "tabs": [
          "overview"
        ]
      },
      {
        "id": "multiple-devices",
        "title": "Multiple devices",
        "summary": "Use the same event on phone, tablet and desktop.",
        "body": [
          "Open the event URL on any device — phone, tablet, or desktop — and changes sync instantly. Sign in with your email's magic link on each device; Admin Mode configuration changes are available to the event owner with no separate password."
        ]
      },
      {
        "id": "mobile-navigation",
        "title": "Mobile navigation",
        "summary": "The bottom tab bar and More menu on a phone.",
        "body": [
          "On screens 900px wide and under, the sidebar collapses and a bottom tab bar appears with five primary tabs (Overview, Guests, Budget, Vendors, Tasks). A small dot on More means a tab inside it has something outstanding.",
          "Tap More to access all remaining tabs, Day-of Mode, theme toggle, Guide, What's New, Activity Log, Admin Mode, and sign out in a slide-up drawer."
        ]
      }
    ]
  }
];

// Start here task cards. Data, not component code: { title, hint, section, topic }.
export const GUIDE_TASKS = [
  { title: "Add your guests",   hint: "Import a CSV or type households in", section: "guests",          topic: "importing-guests-from-csv" },
  { title: "Email your guests", hint: "Save the Date, invitations, reminders", section: "guests",       topic: "messaging-your-guests" },
  { title: "Track a payment",   hint: "Schedules, deposits and balances",    section: "budget",          topic: "payment-schedules" },
  { title: "Seat your guests",  hint: "Auto-Seat and tables",                section: "seating",         topic: "auto-seat" },
  { title: "Back up your event", hint: "Export a full copy",                 section: "getting-started", topic: "export-backup" },
  { title: "Switch events",     hint: "Move between events and shared ones", section: "getting-started", topic: "switching-between-events" },
];

export const GUIDE_GROUPS = ["Set up", "Guests and invitations", "Money", "Plan", "Event day", "Tools"];
