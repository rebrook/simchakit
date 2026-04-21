// UI constants — guide sections, action colors, search, calendar, and form helpers

const GUIDE_SECTIONS = [
  {
    id: "getting-started",
    icon: "✦",
    title: "Getting Started",
    color: "var(--accent-primary)",
    colorLight: "var(--accent-light)",
    items: [
      { heading: "How SimchaKit works", body: "SimchaKit is a single-event planning dashboard. Each event has its own URL and data store. All changes sync in real time — open the same URL on any device and you'll see the same data instantly. The sync indicator in the footer shows connection status." },
      { heading: "Admin Mode", body: "Admin Mode (⚙) is where you configure the event — name, type, theme, RSVP URL, timeline, guest groups, meal choices, and catering style. Most tabs read from Admin config, so set it up first. Changes save immediately." },
      { heading: "Archived events", body: "Archiving an event (in Admin Mode) locks all data and disables editing. Archived events are read-only. The banner at the top of each tab indicates archived status." },
      { heading: "Export & backup", body: "Use the Export button in Admin Mode to download a full JSON backup of your event data. You can re-import it at any time. Individual tabs (Budget, Gifts) have CSV export options. The Guests tab has a dedicated Export Guests modal with four formats: By Household, By Person, Mailing / Invitations, and a Printable View — each tailored to a specific audience such as catering, invitation vendor, or day-of staff." },
    ],
  },
  {
    id: "guests",
    icon: "👥",
    title: "Guests",
    color: "var(--accent-primary)",
    colorLight: "var(--accent-light)",
    items: [
      { heading: "Households vs. people", body: "Guests are organized as households (one invitation) containing individual people. A household tracks the formal invitation name, structured address (street, city, state/province, postal code, country), RSVP status, and which sub-events the household is invited to. People within a household track individual details — title, dietary needs, meal choice, shirt size, seating, and which sub-events each person is confirmed to attend. When editing an existing household, the modal opens in tab mode (Details, Address, Members, Flags & Notes, Contact Log) so you can jump directly to the section you need. Adding a new household uses a two-step guided flow." },
      { heading: "RSVP statuses", body: "Statuses flow from Invited → RSVP Yes / RSVP No, with Pending and Maybe as intermediate states. The Guests tab header badge shows the total number of invited people. The stat grid breaks down attending, out-of-town, save-the-dates sent, invites sent, kippot needed, kosher meals, and address completion." },
      { heading: "Sub-event attendance", body: "Sub-event tracking works in two tiers. Tier 1 (household): which sub-events is this household invited to? Set these upfront using the Sub-Events Invited To checklist when adding or editing a household. Options come from your event timeline in Admin Mode. Tier 2 (person): which of those sub-events is each individual confirmed to attend? Set these as RSVPs arrive using the Attending Sub-Events checkboxes on each person within the household. An empty checklist means attendance is not yet confirmed (TBD). Per-person attendance flows automatically to seating (only confirmed attendees for the selected sub-event appear unseated), favors (attendance derived without manual entry), and the Attendance by Sub-Event chart in Guest Insights." },
      { heading: "Bulk RSVP update", body: "Select multiple households at once using the checkboxes on each row. A select-all checkbox in the filter bar selects all currently visible households — useful when filtering by group or status first. Once households are selected, a blue action bar appears above the list where you can choose a new RSVP status and click Apply to update all selected households in one action." },
      { heading: "Save-the-dates & invitations", body: "Mark each household when a save-the-date or invitation has been mailed using the checkboxes in the household row. The stat cards track completion progress across the full list." },
      { heading: "Out-of-town guests", body: "Flag households as out-of-town to track them in the Stay & Travel tab. The 🧳 filter in the Guests tab shows only out-of-town households. Out-of-town count appears in the stat grid." },
      { heading: "Catering Summary", body: "The collapsible Catering Summary card sits between the stat grid and filters. It adapts to your catering style set in Admin Mode: Plated shows a meal choice table (confirmed vs. invited); Buffet with exceptions shows kosher count and dietary flags; Buffet headcount only shows a total count. Meal choice options are configurable in Admin Mode → Guests. Use 📋 Copy for caterer to generate a clean plain-text summary." },
      { heading: "Dietary requirements", body: "Enter dietary notes on individual people records. The Catering Summary surfaces all dietary requirements with a ✓ Confirmed or ? Pending badge based on the household RSVP status. Kosher meals are flagged separately with a boolean and counted in the stat grid." },
      { heading: "Importing guests from CSV", body: "Use the Import button in the Guests tab to load a guest list from any CSV file — not just the SimchaKit template. SimchaKit natively supports exports from Evite (Name, Email, Phone, Status, RSVP Comment columns), online-rsvp.com (person-by-person format with Group ID), Google Contacts (Given Name, Family Name, Address 1 - Street/City/Region, etc.), WedSites, Joy, and Paperless Post. RSVP values from all supported tools are automatically mapped to SimchaKit statuses — e.g. Evite's No Reply/Viewed/Delivered/Sent all map to Invited, and Yes/No/Maybe map directly. After uploading, SimchaKit auto-detects your column names using fuzzy matching and skips the mapping screen when all columns resolve. For person-by-person exports (online-rsvp.com), rows are grouped into households by Group ID and formal names are constructed automatically (e.g. 'Julie & Jon Singer'). If any columns can't be matched automatically, a mapping screen lets you assign them before proceeding. A preview screen always shows all households that will be imported, with any problem rows listed prominently above it. Use Append mode to add to your existing list, or Replace mode to start fresh. Download the CSV template from the import screen for a pre-formatted starting point." },
      { heading: "Exporting guests", body: "The ↓ Export Guests button opens a four-option export modal. By Household exports one CSV row per household — formal name, RSVP status, headcount, address, and sub-events invited to. Best for your planner or a full reference spreadsheet. By Person exports one CSV row per individual — first name, last name, meal choice, kosher flag, dietary notes, shirt size, and table assignment. Best for catering, a favors vendor, or day-of staff. Mailing / Invitations exports formal names with address fields split into separate columns (Street, City, State, Zip) — ready for mail-merge or a calligrapher. Printable View generates a print-ready HTML page grouped by family / friend group, showing members, RSVP status, headcount, and dietary flags — ideal for a day-of binder or door checklist." },
    ],
  },
  {
    id: "budget",
    icon: "💰",
    title: "Budget",
    color: "var(--gold)",
    colorLight: "var(--gold-light)",
    items: [
      { heading: "Tracking expenses", body: "Each expense has a description, category, vendor, amount, and optional due date. Mark expenses as paid using the checkbox. The stat cards show total, paid, and outstanding at a glance. Expenses group by category in the breakdown panel." },
      { heading: "Due dates & payment suggestions", body: "Set a due date on any expense to get it surfaced in the Task Suggestions panel (Tasks tab) and the Planning Calendar. Overdue and upcoming payment suggestions appear automatically — no manual task creation needed." },
      { heading: "Budgeted vs. actual", body: "Add an optional Budgeted ($) amount to any expense to track estimate vs. actual variance. The Est. vs. Actual stat card appears once at least one budgeted amount exists, showing total variance across all estimated items." },
      { heading: "Gratuity calculator", body: "The Gratuity Calculator (bottom of the Budget tab) auto-detects tippable vendors from your expense list. Set a tip rate (15/20/25% or custom), adjust per-vendor base amounts, and click + Add to Budget to log the tip as a new expense." },
      { heading: "Budget by timeline", body: "Tag each expense with the part of the event it belongs to — Service, Kiddush, Sweet Shop Party, etc. — using the Event Section dropdown in the expense form. The section list is built from your timeline entries in Admin Mode. Once tagged, switch to 📅 By Timeline view in the Budget tab to see total, paid, and outstanding broken down per section. The section filter in the filter bar lets you isolate one part of the event at a time." },
    ],
  },
  {
    id: "vendors",
    icon: "🏪",
    title: "Vendors",
    color: "var(--orange)",
    colorLight: "var(--orange-light)",
    items: [
      { heading: "Vendor overview", body: "The stat cards at the top show Total Vendors, Confirmed (booked or paid), Total Contracted, Total Paid, and Need Follow-up. Click the Need Follow-up card to instantly filter to vendors that haven't been contacted in 60+ days or have never been contacted — click again to clear the filter." },
      { heading: "Vendor cards", body: "Each vendor card shows name, type, status, contact details, financials (contract / paid / scheduled / unscheduled balance), payment progress bar, and last contacted date. Click the vendor name or the View button to open the Quick View panel. Click ✎ to edit. Click ✕ to delete — a confirmation prompt appears first. If the vendor has notes, click the notes area to expand or collapse them." },
      { heading: "Contract milestones", body: "Add key contract dates as milestones on each vendor — headcount deadlines, asset submission windows, delivery dates. Milestones appear in the Quick View with proximity badges (green > 30 days, amber ≤ 30 days, red overdue). Milestones within 60 days generate Task Suggestions automatically." },
      { heading: "Linking expenses", body: "Link Budget expenses to a vendor by selecting the vendor name when creating the expense. Linked expenses feed the vendor's financial progress bar and are excluded from the unscheduled balance suggestion." },
      { heading: "Contract link", body: "Paste a Dropbox, Google Drive, or any shared link in the Contract Link field. A 📄 View Contract button appears in the Quick View, making it easy to pull up the signed agreement." },
      { heading: "Contact log", body: "Record every interaction with a vendor — calls, emails, meetings, in-person visits, and contract signings — using the Contact Log section in the vendor edit form. Each entry has a date, type badge, and free-text notes. Entries are shown in the Quick View sorted most-recent first, giving you an instant answer to 'when did I last talk to them and what did we discuss?'" },
    ],
  },
  {
    id: "tasks",
    icon: "✅",
    title: "Tasks",
    color: "var(--blue)",
    colorLight: "var(--blue-light)",
    items: [
      { heading: "Manual tasks", body: "Add tasks with a title, due date, category, and priority. Check them off as you complete them. The stat cards show Total Tasks, Completed (with % done), Overdue, and Due This Week at a glance. The Task Insights panel (below stat cards) provides collapsible charts: a completion progress bar and breakdowns by category and priority for incomplete tasks. Overdue tasks are flagged with ⚠ in red. The Tasks tab badge in the nav shows the count of incomplete tasks." },
      { heading: "Smart suggestions", body: "The Suggestions panel (top of the Tasks tab) automatically surfaces action items derived from your data — unpaid expenses with due dates, vendors with unscheduled balances, vendor milestones within 60 days, prep items with upcoming target dates, missing guest addresses, and RSVP deadline countdowns. Dismiss suggestions you don't need. Suggestions linked to a specific record show a \u2192 View button — tapping it navigates directly to the source tab and highlights the matching record." },
      { heading: "Categories", body: "Tasks and suggestions are organized by category (Vendor, Budget, Planning, Guests, etc.) for easy filtering. The category filter in the filter bar lets you focus on one area at a time." },
      { heading: "Sorting and grouping", body: "Use the Sort dropdown to sort tasks by Due date, Priority, Category, or A–Z. When sorting by Due date or Category with no active search or filter, tasks are automatically grouped under category headers — making it easy to scan what's outstanding in each planning area at a glance. Completed tasks always float to the bottom regardless of sort." },
      { heading: "Linked task completion", body: "Some tasks are linked to a specific budget expense or prep item — for example, a task automatically created when a payment due date is set. When you check off a linked task, a prompt asks whether you also want to mark the linked expense as paid or the prep item as Complete. Choose 'Complete Task Only' to check off just the task, or the primary button to update both records at once." },
    ],
  },
  {
    id: "prep",
    icon: "📖",
    title: "Prep",
    color: "var(--green)",
    colorLight: "var(--green-light)",
    items: [
      { heading: "Preparation items", body: "The Prep tab tracks the honoree's preparation journey — Torah/Haftarah study, d'var Torah writing, service prayers, mitzvah project, and custom items. Items are grouped by category with a header and item count. Each item has a status badge (Not Started / In Progress / Nearly Done / Complete) and a progress percentage. The Overall Progress bar at the top shows the average progress across all items. Use the inline slider on any item card to update progress — the status auto-derives as you drag (1–49% → In Progress, 50–99% → Nearly Done, 100% → Complete). Target dates are color-coded: green (>14 days away), amber (≤14 days), red (overdue). The stat cards show Total Items, Complete, In Progress, and Not Started at a glance." },
      { heading: "Target dates", body: "Set a target date on any prep item to surface it in the Planning Calendar and Task Suggestions. Prep items with target dates are shown in the calendar unless a task already covers them (deduplication). Once Complete, they no longer generate suggestions." },
      { heading: "Tutor & session notes", body: "The notes field on each prep item is a good place to track tutor feedback, session dates, and practice schedules. Notes are collapsed by default — click ▾ notes on any item card to expand, and ▴ hide notes to collapse. Notes also appear in the calendar popover for prep items with target dates." },
      { heading: "Clergy & Tutor contacts", body: "When Rabbi, Cantor, or Tutor contact details are configured in Admin Mode, a quick-reference contact card appears at the top of the Prep tab showing their name, phone, email, and notes. For B'nei Mitzvah events, all three contacts are shown. For other event types, only the Rabbi is shown unless added manually. The email address is a clickable mailto link." },
    ],
  },
  {
    id: "seating",
    icon: "🪑",
    title: "Seating",
    color: "var(--accent-primary)",
    colorLight: "var(--accent-light)",
    items: [
      { heading: "Seating Setup", body: "Before building your chart, open the Seating Setup panel at the top of the tab and check 'This event has assigned seating', then choose which sub-event you are seating for. Only people with that sub-event confirmed in their per-person attendance will appear in the unseated panel. People with TBD attendance are excluded until confirmed in the Guests tab. The setup is saved and persists across sessions." },
      { heading: "Creating tables", body: "Add tables with a name, capacity, and type (Adult / Kids / Mixed). Table cards show a capacity progress bar and the list of assigned guests. Reorder tables with the ↑ ↓ buttons." },
      { heading: "Assigning guests", body: "Select a person from the unseated panel then click a table to assign them, or use Manage Assignments on any table card for bulk assignment. The unseated panel shows only people confirmed for the active sub-event — if someone is missing, check their sub-event attendance in the Guests tab." },
      { heading: "TBD attendees", body: "People whose sub-event attendance is not yet confirmed (TBD) are excluded from the unseated panel and shown as a count below the Unseated header. They cannot be seated until their attendance is confirmed in the Guests tab." },
      { heading: "Seating gap warning", body: "The Overview tab shows a seating gap warning when the total configured seat capacity is less than the confirmed attendee count for the active seating sub-event. The warning only appears when seating is configured for a specific sub-event." },
      { heading: "Exporting the seating chart", body: "Use the ↓ Export Seating button (visible once seating is configured and tables exist) to export in three formats. By Table exports a CSV with tables as columns and names listed underneath — best for venue staff and day-of binders. By Person exports a CSV with one row per person including their table, household, group, and meal choice — best for catering and planning. Printable View generates a print-ready HTML page grouped by table with names, household, group, meal, and dietary flags — open it in your browser and use Print to PDF." },
    ],
  },
  {
    id: "gifts",
    icon: "🎁",
    title: "Gifts",
    color: "var(--green)",
    colorLight: "var(--green-light)",
    items: [
      { heading: "Recording gifts", body: "Log each gift with the donor's name, gift type, amount, description, date received, and whether the donor attended. If the name matches a household in your guest list, the record links automatically and pulls in their address — no manual entry needed. For donors not on your guest list, enter their address manually for use in thank-you exports. The stat cards show Total Gifts, Total Monetary Value (all gifts with amounts), Cash / Check Total, Thank Yous Pending (not yet written), and Thank Yous Complete (written and mailed)." },
      { heading: "Thank-you tracking", body: "Each gift tracks two independent thank-you steps: Written (the note has been written) and Mailed (the note has been sent). Toggle each step directly on the table row — Written uses a green checkbox, Mailed uses a blue checkbox. Filter by Needs Written, Written Needs Mailed, or Complete to work through your list in order. The Thank Yous Complete stat card counts only gifts where both steps are done." },
      { heading: "Exporting gifts", body: "Click ↓ Export to open the export modal. CSV Export generates one row per gift sorted by last name, including address, amounts, and thank-you status — paste into Excel. Printable View generates a print-ready HTML page grouped by donor with address, gift details, and thank-you status, which doubles as a mailing checklist." },
    ],
  },
  {
    id: "favors",
    icon: "⭐",
    title: "Favors",
    color: "var(--gold)",
    colorLight: "var(--gold-light)",
    items: [
      { heading: "Favor Setup", body: "The Favor Setup card at the top of the tab controls the entire tab. Check 'Are you giving out favors?' to activate tracking. Then set: what the favor is (e.g., Sweatshirts), who receives one (All guests, All kids, All adults, or Select manually), whether sizing is needed, whether favors are personalized (enables the Name on Favor and Pre-Printed columns), and whether to track distribution attendance. Click Save Settings to apply. The setup card collapses once configured — click the header to expand and edit at any time." },
      { heading: "Available panel", body: "The right-hand panel shows everyone from your guest list who hasn't been added to favors yet. The list automatically filters to match your 'Who receives a favor?' setting — only kids appear when set to All kids, only adults when set to All adults. Click any person to add them instantly. Their size is auto-filled from their guest record (shirt or pant size, depending on your setting). Use the search and group filter to find specific people quickly." },
      { heading: "Favor list and inline editing", body: "The left panel shows all current favor recipients. Columns shown depend on your setup — Size appears when sizing is on, Name on Favor and Pre-Printed appear when personalization is on, Attending appears when attendance tracking is on. Click the Pre-Printed or Attending value on any row to cycle through TBD → Yes → No without opening a modal. Use the edit button to change name, size, category, or other fields." },
      { heading: "Size and category breakdown", body: "When sizing is enabled, a size breakdown card shows counts per size code (YS through XXL plus Total) — click any size to filter the list. A category breakdown card shows counts by Adult, Kid, Class, or Other — click any category to filter. Both cards update live as you add or edit recipients." },
      { heading: "Export", body: "The ↓ Export CSV button copies a spreadsheet-ready CSV to your clipboard. Columns included in the export match your current setup — size is included when needsSizing is on, print name and pre-print status when personalization is on, attending status when attendance tracking is on." },
    ],
  },
  {
    id: "travel",
    icon: "🧳",
    title: "Stay & Travel",
    color: "var(--blue)",
    colorLight: "var(--blue-light)",
    items: [
      { heading: "Out-of-town tracking", body: "The Stay & Travel tab shows all households flagged as out-of-town. Track whether each household has been notified about accommodations and whether they've booked. The stat cards show total out-of-town, notified, and booked counts." },
      { heading: "Hotel block details", body: "Configure your hotel room block in Admin Mode — hotel name, block name, phone number, and cut-off date. These details appear in the Stay & Travel header for easy reference when guests call to ask about booking." },
      { heading: "Check-in & check-out", body: "Record check-in and check-out dates on each household for catering and logistics planning. The dates appear in the household row and in the accommodation detail view." },
    ],
  },
  {
    id: "calendar",
    icon: "📅",
    title: "Planning Calendar",
    color: "var(--accent-primary)",
    colorLight: "var(--accent-light)",
    items: [
      { heading: "What appears on the calendar", body: "The Planning Calendar aggregates five sources: your event timeline (from Admin Mode), tasks with due dates, unpaid expenses with due dates, vendor contract milestones, and prep items with target dates. Each source has its own color — rose for events, blue for tasks, gold for payments, orange for milestones, green for prep." },
      { heading: "Deduplication", body: "If a task already covers a vendor milestone or prep item (by title match), the milestone or prep entry is suppressed — no duplicate deadlines. If no task covers it yet, the entry still appears so nothing falls through the cracks." },
      { heading: "List vs. month view", body: "Toggle between ☰ List and 📅 Month views using the control in the filter bar. List view groups events by month with full detail. Month view shows a 7-column grid with color-coded chips per day. On mobile, the app automatically switches to list view." },
      { heading: "Click popover & navigation", body: "Click any event in either view to open a detail popover with full title, date, source, and meta. The → [Tab] button navigates directly to the source tab and highlights the originating row." },
      { heading: "Filters", body: "Use the source filter to show only one category (Events, Tasks, Payments, Milestones, or Prep). The Show Completed toggle reveals completed tasks and paid expenses, hidden by default." },
    ],
  },
  {
    id: "search",
    icon: "🔍",
    title: "Search",
    color: "var(--blue)",
    colorLight: "var(--blue-light)",
    items: [
      { heading: "Opening search", body: "Press ⌘K (Mac) or Ctrl+K (Windows/Linux) to open the global search overlay from anywhere in the app. You can also click the 🔍 button in the header. Close with Escape or by clicking the backdrop." },
      { heading: "What's searchable", body: "Search covers all 9 collections: Guests (households and individual people), Vendors, Expenses, Tasks, Prep, Gifts, Favors, and Calendar events. Results are grouped by collection with up to 4 results shown — click Show all to expand any group." },
      { heading: "Navigating to results", body: "Clicking a result navigates to the source tab and highlights the matching row with an amber glow. For guest people results, the app scrolls to the household card and expands it. Calendar results navigate to the Calendar tab." },
    ],
  },
  {
    id: "admin",
    icon: "⚙",
    title: "Admin Mode",
    color: "var(--orange)",
    colorLight: "var(--orange-light)",
    items: [
      { heading: "Accessing Admin Mode", body: "Click ⚙ in the header. Admin Mode is password-protected. The password is set by the event owner and stored in the server config. The ⚙ icon turns highlighted while Admin Mode is active." },
      { heading: "Event Details", body: "Set the event name, type (Bar/Bat Mitzvah, Wedding, etc.), theme, RSVP URL, RSVP deadline, and catering style. The event name appears in the header. The RSVP deadline triggers a countdown banner in the Guests tab." },
      { heading: "Timeline", body: "Build the event timeline here — each entry has a title, icon, date, start/end time, venue, and an Is Main Event flag. Timeline entries appear on the Overview tab, the Planning Calendar, and the Print Brief." },
      { heading: "Guest configuration", body: "Customize guest groups, meal choices, and sizes in the Guests section of Admin Mode. Guest groups control the filter options and household group dropdown (e.g., Family, Friends, Sydney's Class). Meal choices drive the household meal selection and Catering Summary. Sizes (shirt & pant) use a CODE | Label format (e.g. AS | Adult Small) — the code appears in the Favors size summary, the full label in dropdowns. All three lists support add, remove, reorder, and reset to defaults." },
      { heading: "Hotel block", body: "Enter hotel block details (hotel name, block name, phone, cut-off date) so they appear in the Stay & Travel tab header for easy reference." },
    ],
  },
  {
    id: "dayof",
    icon: "📋",
    title: "Day-of Mode",
    color: "var(--accent-primary)",
    colorLight: "var(--accent-light)",
    items: [
      { heading: "Opening Day-of Mode", body: "Click the 📋 button in the header to open Day-of Mode. On days that match a timeline entry, the button appears directly in the header highlighted in the accent color with a green dot — one tap away. On all other days it lives in the ⋯ overflow menu. Day-of Mode opens as a full-screen overlay — no nav, no distractions. Close it with the ✕ button to return to the dashboard." },
      { heading: "Event Timeline", body: "Your Admin Mode timeline entries appear in chronological order. Tap each row to check it off as it gets underway or completes. Checks persist across device refreshes — closing and reopening the overlay keeps your progress." },
      { heading: "Hot Sheet", body: "Key numbers at a glance: confirmed guest count, kosher meals required, and dietary flags with confirmed/pending status. Below that, all booked vendors with their contact name and a tap-to-call phone link — no digging through vendor cards needed." },
      { heading: "Day-of Checklist", body: "A manual checklist you build in the weeks before the event. Each item has a task description and a time block (Morning / Midday / Afternoon / Evening / Wrap-up). Items are grouped by time block so at 3 PM you only see the afternoon tasks. Add items with + Add Item directly in the overlay. Check items off by tapping the circle." },
      { heading: "Notes", body: "A free-text scratch pad shared with the Overview tab Quick Notes. Anything you jot here syncs across all devices in real time — useful for logging decisions, vendor confirmations, or last-minute changes as the day unfolds." },
    ],
  },
  {
    id: "activitylog",
    icon: "📊",
    title: "Activity Log",
    color: "var(--blue)",
    colorLight: "var(--blue-light)",
    items: [
      { heading: "What the Activity Log tracks", body: "The Activity Log records meaningful changes across the app — households added, updated, or deleted; RSVP status changes; expenses added or marked paid; vendors added or deleted; tasks completed; and gifts added. Minor edits (notes, field tweaks) are not logged to keep the history clean and readable." },
      { heading: "Opening the Activity Log", body: "Click the ⋯ More button in the header and select 📋 Activity Log. The log opens as an overlay and shows all entries newest first." },
      { heading: "Filtering entries", body: "Use the filter buttons at the top of the overlay to show only Added, Updated, Deleted, or Completed entries. Select All to see the full history." },
      { heading: "Clearing the log", body: "The Clear Log button (visible to the right of the filters) wipes all entries. A confirmation prompt appears before clearing. This action cannot be undone. The button is hidden when the event is archived." },
      { heading: "Write failure alerts", body: "If an activity log entry fails to save — for example due to a network interruption — a warning toast appears at the bottom of the screen: \"⚠ Activity log entry could not be saved\". Your planning data is never affected; only the log entry is lost." },
      { heading: "Archiving and resetting", body: "When an event is archived, the Activity Log is preserved as part of the historical record and becomes read-only. When event data is reset via Admin Mode, the Activity Log is cleared along with all other collections." },
    ],
  },
  {
    id: "tips",
    icon: "💡",
    title: "Tips & Shortcuts",
    color: "var(--gold)",
    colorLight: "var(--gold-light)",
    items: [
      { heading: "Confirmation toasts", body: "After any add, edit, or delete action — adding a guest, marking an expense paid, completing a task, logging a gift, and so on — a small confirmation message briefly appears at the bottom of the screen and fades away automatically. This is called a toast notification. No action is needed to dismiss it." },
      { heading: "Tab indicators", body: "Tabs that contain at least one record show a small filled dot in the nav bar. This lets you see at a glance which planning areas have been started without opening each tab. The dot is suppressed on tabs that already show a numeric badge count (Budget, Tasks, Stay & Travel)." },
      { heading: "Keyboard shortcuts", body: "⌘K / Ctrl+K opens global search from anywhere. Escape closes any open modal or overlay. These are the only keyboard shortcuts currently supported — more are planned." },
      { heading: "Dark mode", body: "Use the ☀ / 🌙 / 💻 toggle in the header to switch between light, dark, and system-following modes. Your preference is saved to your browser." },
      { heading: "Sync & offline", body: "SimchaKit syncs in real time over a WebSocket connection. If you go offline, changes queue locally and sync automatically when the connection restores. The sync indicator in the footer shows Live, Connecting, Offline, or ⏳ N pending. After any data change, the indicator updates to show when data was last saved — 'Saved just now', 'Saved 2m ago', and so on." },
      { heading: "Print Brief", body: "The 🖨 Print Brief button in the Overview tab header generates a printable HTML summary of your event: timeline, guest counts, dietary summary, confirmed vendors with payment progress, and open tasks. The same button is also available inside Day-of Mode. Use your browser's Print to PDF to save it." },
      { heading: "Multiple devices", body: "Open the event URL on any device — phone, tablet, or desktop — and changes sync instantly. There's no login required beyond the Admin Mode password for configuration changes." },
      { heading: "Mobile navigation", body: "On screens 640px wide and under, the main nav moves to a bottom tab bar with four primary tabs (Overview, Guests, Budget, Tasks). Tap More \u22ef to access all remaining tabs in a slide-up list. A dot on the More button means at least one secondary tab has a pending badge." },
    ],
  },
];

const ACTION_COLORS = {
  "Added":     { bg: "var(--green-light)",  color: "var(--green)"  },
  "Updated":   { bg: "var(--blue-light)",   color: "var(--blue)"   },
  "Deleted":   { bg: "var(--red-light)",    color: "var(--red)"    },
  "Completed": { bg: "var(--gold-light)",   color: "var(--gold)"   },
};

const TL_HOURS   = ["12","1","2","3","4","5","6","7","8","9","10","11"];

const TL_MINUTES = ["00","15","30","45"];

const FOLLOW_UP_STATUSES = new Set(["Booked","Deposit Paid","Paid in Full"]);

const SEARCH_GROUPS = [
  { key: "households",     label: "Guests",       icon: "👥", tab: "guests"         },
  { key: "people",         label: "People",        icon: "🙋", tab: "guests"         },
  { key: "vendors",        label: "Vendors",       icon: "🏪", tab: "vendors"        },
  { key: "expenses",       label: "Expenses",      icon: "💰", tab: "budget"         },
  { key: "tasks",          label: "Tasks",         icon: "✅", tab: "tasks"          },
  { key: "prep",           label: "Prep",          icon: "📖", tab: "prep"           },
  { key: "gifts",          label: "Gifts",         icon: "🎁", tab: "gifts"          },
  { key: "favors",         label: "Favors",        icon: "⭐", tab: "favors"         },
  { key: "calendar",       label: "Calendar",      icon: "📅", tab: "calendar"       },
];

const SEARCH_PER_GROUP = 4;

const CAL_SOURCES = [
  { key:"timeline",  label:"Events",     dotCls:"cal-dot-timeline",  tagCls:"cal-source-timeline"  },
  { key:"task",      label:"Tasks",      dotCls:"cal-dot-task",      tagCls:"cal-source-task"      },
  { key:"payment",   label:"Payments",   dotCls:"cal-dot-payment",   tagCls:"cal-source-payment"   },
  { key:"milestone", label:"Milestones", dotCls:"cal-dot-milestone", tagCls:"cal-source-milestone" },
  { key:"prep",      label:"Prep",       dotCls:"cal-dot-prep",      tagCls:"cal-source-prep"      },
];

export {
  GUIDE_SECTIONS,
  ACTION_COLORS,
  TL_HOURS,
  TL_MINUTES,
  FOLLOW_UP_STATUSES,
  SEARCH_GROUPS,
  SEARCH_PER_GROUP,
  CAL_SOURCES,
};
