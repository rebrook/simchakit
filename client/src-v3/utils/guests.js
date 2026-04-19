import { newHouseholdId, newPersonId } from "./ids.js";

// ── Address constants ─────────────────────────────────────────────────────────

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC","AS","GU","MP","PR","VI",
];

const CA_PROVINCES = [
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
];

const AU_STATES = ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"];

const MX_STATES = [
  "AGU","BCN","BCS","CAM","CHP","CHH","COA","COL","CDMX","DUR",
  "GUA","GRO","HID","JAL","MEX","MIC","MOR","NAY","NLE","OAX",
  "PUE","QUE","ROO","SLP","SIN","SON","TAB","TAM","TLA","VER",
  "YUC","ZAC",
];

const UK_REGIONS = ["England","Scotland","Wales","Northern Ireland"];

// Countries exported for use in UI dropdowns
export const COUNTRIES = [
  "United States","Canada","United Kingdom","Australia","Mexico",
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda",
  "Argentina","Armenia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh",
  "Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso",
  "Burundi","Cabo Verde","Cambodia","Cameroon","Central African Republic","Chad",
  "Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba",
  "Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia",
  "Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia",
  "Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau",
  "Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran",
  "Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan",
  "Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho",
  "Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi",
  "Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius",
  "Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique",
  "Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua",
  "Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan",
  "Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines",
  "Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
  "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles",
  "Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia",
  "South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania",
  "Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam",
  "Yemen","Zambia","Zimbabwe",
];

// ── Address helpers ───────────────────────────────────────────────────────────

/**
 * Returns country-specific address field config:
 * { stateLabel, postalLabel, stateOptions }
 * stateOptions is null for free-text countries.
 */
function getAddressFields(country) {
  switch (country) {
    case "United States":
      return { stateLabel: "State", postalLabel: "ZIP Code", stateOptions: US_STATES };
    case "Canada":
      return { stateLabel: "Province", postalLabel: "Postal Code", stateOptions: CA_PROVINCES };
    case "Australia":
      return { stateLabel: "State / Territory", postalLabel: "Postcode", stateOptions: AU_STATES };
    case "Mexico":
      return { stateLabel: "State", postalLabel: "Postal Code", stateOptions: MX_STATES };
    case "United Kingdom":
      return { stateLabel: "Region", postalLabel: "Postcode", stateOptions: UK_REGIONS };
    default:
      return { stateLabel: "State / Province / Region", postalLabel: "Postal Code", stateOptions: null };
  }
}

/**
 * Assembles a display address string from structured fields.
 * Works for households, gifts (non-linked), and vendors.
 * e.g. "742 Evergreen Terrace, Springfield, IL 62701, United States"
 */
function formatAddress(record) {
  if (!record) return "";
  const parts = [];
  if (record.address1)      parts.push(record.address1);
  if (record.address2)      parts.push(record.address2);
  const cityLine = [record.city, record.stateProvince, record.postalCode].filter(Boolean).join(" ");
  if (cityLine)             parts.push(cityLine);
  if (record.country && record.country !== "United States") parts.push(record.country);
  return parts.join(", ");
}

/**
 * Migration helper: if a record has cityStateZip but no city,
 * copy cityStateZip into city so existing data is preserved.
 */
function migrateCityStateZip(record) {
  if (!record) return record;
  if (record.cityStateZip && !record.city) {
    return { ...record, city: record.cityStateZip, stateProvince: "", postalCode: "" };
  }
  return record;
}

// ── Guest and household utilities ─────────────────────────────────────────────

function getPeopleForHousehold(people, householdId) {
  return (people||[]).filter(p => p.householdId === householdId);
}

function isMaleTitle(title) {
  return ["Mr.","Dr.","Rabbi","Cantor"].includes(title);
}

function computeHouseholdCounts(people, householdId) {
  const m = getPeopleForHousehold(people, householdId);
  return {
    adults:    m.filter(p => !p.isChild).length,
    kids:      m.filter(p =>  p.isChild).length,
    males:     m.filter(p => isMaleTitle(p.title)).length,
    kosher:    m.filter(p => p.kosher).length,
    attending: m.filter(p => p.isAttending === true).length,
    total:     m.length,
  };
}

function getHouseholdAttending(household, people) {
  const counts = computeHouseholdCounts(people, household.id);
  return {
    adults: household.attendingAdults != null ? household.attendingAdults : counts.adults,
    kids:   household.attendingKids   != null ? household.attendingKids   : counts.kids,
  };
}

function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return raw.trim();
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g,""));
  return lines.slice(1).map(line => {
    const vals = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur);
    const obj = {};
    headers.forEach((h,i) => { obj[h] = (vals[i]||"").trim(); });
    return obj;
  });
}

function generateCSVTemplate(adminConfig) {
  const groups  = adminConfig?.groups        || DEFAULT_GROUPS;
  const secs    = adminConfig?.eventSections || DEFAULT_SECTIONS;
  const meals   = adminConfig?.mealChoices   || DEFAULT_MEALS;
  const headers = [
    "HouseholdID","FormalName","Name2","Address1","Address2",
    "City","StateProvince","PostalCode","Country",
    "Phone","Email","Group","Status","EventSection","SaveTheDateSent","InviteSent",
    "AccommodationNeeded","HouseholdNotes",
    "PersonFirstName","PersonLastName","Title","IsChild","IsAttending","ShirtSize","PantSize",
    "MealChoice","Kosher","Dietary","PersonNotes"
  ];
  const ex = [
    "1","Mr. and Mrs. Homer Simpson","Miss Lisa Simpson and Mr. Bart Simpson",
    "742 Evergreen Terrace","","Springfield","IL","62701","United States",
    "555-636-4738","homer@springfieldnuclear.com",
    groups[0]||"Family","Invited",secs[0]||"All Events","No","No","No","",
    "Lisa","Simpson","Miss","Yes","","S","S",meals[0]||"","No","Peanut allergy",""
  ];
  const esc = v => { const s=String(v||""); return (s.includes(",")||s.includes('"')) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  return [headers.join(","), ex.map(esc).join(",")].join("\n");
}

// ── CSV import field aliases ───────────────────────────────────────────────────
// Maps SimchaKit field names to arrays of recognized column name aliases.
// All comparisons are case-insensitive and whitespace-normalized.
export const FIELD_ALIASES = {
  HouseholdID:       ["householdid", "household id", "id", "group id", "groupid", "household", "party", "group name", "groupname"],
  FormalName:        ["formalname", "formal name", "household name", "householdname", "name", "family name", "familyname", "name on envelope"],
  Name2:             ["name2", "name 2", "second name", "additional names"],
  Address1:          ["address1", "address 1", "address", "street", "street address", "streetaddress", "address 1 - street"],
  Address2:          ["address2", "address 2", "apt", "suite", "unit"],
  City:              ["city", "town", "municipality", "address 1 - city"],
  StateProvince:     ["stateprovince", "state/province", "state", "province", "region", "address 1 - region"],
  PostalCode:        ["postalcode", "postal code", "zip", "zip code", "zipcode", "postcode", "address 1 - postal code"],
  Country:           ["country", "address 1 - country"],
  Phone:             ["phone", "telephone", "phone number", "phonenumber", "mobile", "cell", "mobile phone", "phone 1 - value"],
  Email:             ["email", "email address", "emailaddress", "e-mail", "e mail", "email or phone", "e-mail 1 - value"],
  Group:             ["group", "category", "guest group", "side", "tags"],
  Status:            ["status", "rsvp", "rsvp status"],
  EventSection:      ["eventsection", "event section", "section", "event"],
  SaveTheDateSent:   ["savethedate", "save the date", "savedatedatesent", "save the date sent"],
  InviteSent:        ["invitesent", "invite sent", "invitation sent", "invitationsent"],
  AccommodationNeeded: ["accommodationneeded", "accommodation needed", "hotel", "needs hotel"],
  HouseholdNotes:    ["householdnotes", "household notes", "notes", "family notes", "rsvp comment", "rsvpcomment", "comment"],
  PersonFirstName:   ["personfirstname", "first name", "firstname", "fname", "first", "given name", "givenname"],
  PersonLastName:    ["personlastname", "last name", "lastname", "lname", "last", "surname", "family name", "familyname"],
  Title:             ["title", "salutation", "prefix"],
  IsChild:           ["ischild", "is child", "child", "kid", "age"],
  IsAttending:       ["isattending", "is attending", "attending", "coming"],
  ShirtSize:         ["shirtsize", "shirt size", "shirt", "t-shirt size"],
  PantSize:          ["pantsize", "pant size", "pants", "trouser size"],
  MealChoice:        ["mealchoice", "meal choice", "meal", "food choice", "entree"],
  Kosher:            ["kosher", "kosher meal", "needs kosher"],
  Dietary:           ["dietary", "dietary needs", "dietary restrictions", "allergies", "food notes", "special diet"],
  PersonNotes:       ["personnotes", "person notes", "individual notes"],
};

/**
 * Given an array of CSV header strings, returns a suggested mapping
 * { simchaKitField: matchedColumnName } for each field that can be auto-matched.
 * Also returns unmappedColumns (headers that didn't match any field) and
 * unmappedFields (SimchaKit fields that weren't matched).
 * Confidence: "exact" | "alias" | null
 */
/**
 * Constructs a household FormalName from an array of person objects
 * with { firstName, lastName } fields.
 * Same last name:  "Julie & Jon Singer" / "Sandra, Robert, Charlie & Isabel Burley"
 * Mixed last names: "Julie Singer & Jon Singer" / "Jacob Hodes, Annie Grossberg & Jonah Hodes"
 */
function constructFormalName(members) {
  if (!members || members.length === 0) return "";
  if (members.length === 1) return `${members[0].firstName} ${members[0].lastName}`.trim();
  const lastNames = members.map(m => (m.lastName || "").trim());
  const allSame   = lastNames.every(l => l === lastNames[0]) && lastNames[0];
  if (allSame) {
    const firsts = members.map(m => m.firstName);
    if (firsts.length === 2) return `${firsts[0]} & ${firsts[1]} ${lastNames[0]}`;
    return `${firsts.slice(0, -1).join(", ")} & ${firsts[firsts.length - 1]} ${lastNames[0]}`;
  }
  const fullNames = members.map(m => `${m.firstName} ${m.lastName}`.trim());
  if (fullNames.length === 2) return `${fullNames[0]} & ${fullNames[1]}`;
  return `${fullNames.slice(0, -1).join(", ")} & ${fullNames[fullNames.length - 1]}`;
}

function detectColumnMapping(headers) {
  const normalize = s => s.toLowerCase().replace(/[_\s]+/g, " ").trim();
  const mapping = {};        // simchaKitField -> userColumnName
  const confidence = {};     // simchaKitField -> "exact" | "alias"
  const usedHeaders = new Set();

  // First pass: exact matches (case-insensitive)
  headers.forEach(h => {
    const norm = normalize(h);
    Object.keys(FIELD_ALIASES).forEach(field => {
      if (!mapping[field] && normalize(field) === norm) {
        mapping[field] = h;
        confidence[field] = "exact";
        usedHeaders.add(h);
      }
    });
  });

  // Second pass: alias matches
  headers.forEach(h => {
    if (usedHeaders.has(h)) return;
    const norm = normalize(h);
    Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
      if (!mapping[field] && aliases.includes(norm)) {
        mapping[field] = h;
        confidence[field] = "alias";
        usedHeaders.add(h);
      }
    });
  });

  // Detect person-centric format: has First Name + Last Name but no FormalName equivalent.
  // Tools like online-rsvp.com export one row per person grouped by a group/household ID.
  const hasFormalName  = !!mapping["FormalName"];
  const hasFirstName   = !!mapping["PersonFirstName"];
  const hasLastName    = !!mapping["PersonLastName"];
  const hasGroupId     = !!mapping["HouseholdID"];
  const isPeopleCentric = !hasFormalName && hasFirstName && hasLastName;

  const unmappedColumns = headers.filter(h => !usedHeaders.has(h));
  const unmappedFields  = Object.keys(FIELD_ALIASES).filter(f => !mapping[f]);
  // allMapped: true if FormalName resolved OR we detected a person-centric format
  const allMapped = hasFormalName || isPeopleCentric;

  return { mapping, confidence, unmappedColumns, unmappedFields, allMapped, isPeopleCentric, hasGroupId };
}

/**
 * Normalizes RSVP status strings from various tools into SimchaKit statuses.
 * Covers: online-rsvp.com, Evite, RSVPify, WedSites, Paperless Post, Joy, and generic values.
 */
function mapRsvp(raw) {
  const r = (raw || "").toLowerCase().trim();
  if (["yes", "attending", "accepted", "confirmed", "going"].includes(r)) return "RSVP Yes";
  if (["no", "declined", "not attending", "regretfully decline", "regrets", "not going", "can't go", "cannot go"].includes(r)) return "RSVP No";
  if (["maybe", "possibly", "tentative", "might attend"].includes(r)) return "Maybe";
  if (["no reply", "not yet", "awaiting", "pending", "invited", "viewed", "delivered", "sent", "not invited yet"].includes(r)) return "Invited";
  return "Invited";
}

function importCSVToGuestData(rows, mapping, isPeopleCentric) {
  // If no mapping provided, build identity mapping from field names
  const fieldMap = mapping || Object.fromEntries(
    Object.keys(FIELD_ALIASES).map(f => [f, f])
  );

  const get = (row, field) => {
    const col = fieldMap[field];
    return col ? (row[col] || "").trim() : "";
  };

  // ── Person-centric path (e.g. online-rsvp.com exports) ───────────────────
  // Rows are one-per-person, grouped by HouseholdID (Group ID).
  // Rows with no HouseholdID are solo entries (one-person households).
  if (isPeopleCentric) {
    const householdsMap = {};  // hhKey -> { hhData, members[] }
    const errors = [];

    rows.forEach((row, idx) => {
      try {
        const firstName = get(row, "PersonFirstName");
        const lastName  = get(row, "PersonLastName");
        if (!firstName && !lastName) {
          errors.push({ rowIndex: idx + 2, rawRow: row, message: "Missing first and last name — row skipped" });
          return;
        }
        const groupId = get(row, "HouseholdID");
        const hhKey   = groupId || (`solo_${idx}`);
        if (!householdsMap[hhKey]) {
          householdsMap[hhKey] = {
            groupId,
            members: [],
            // Capture household-level fields from the first row of this group
            email:   get(row, "Email"),
            phone:   get(row, "Phone"),
            group:   get(row, "Group"),
            rsvpRaw: get(row, "Status"),
            notes:   get(row, "HouseholdNotes"),
          };
        }
        // Always update email/phone/group from the first non-empty row in the group
        if (!householdsMap[hhKey].email && get(row, "Email"))  householdsMap[hhKey].email  = get(row, "Email");
        if (!householdsMap[hhKey].phone && get(row, "Phone"))  householdsMap[hhKey].phone  = get(row, "Phone");
        if (!householdsMap[hhKey].group && get(row, "Group"))  householdsMap[hhKey].group  = get(row, "Group");
        if (!householdsMap[hhKey].rsvpRaw && get(row, "Status")) householdsMap[hhKey].rsvpRaw = get(row, "Status");
        householdsMap[hhKey].members.push({ firstName, lastName });
      } catch (err) {
        errors.push({ rowIndex: idx + 2, rawRow: row, message: err.message || "Unexpected error processing row" });
      }
    });

    const households = [];
    const people     = [];

    Object.values(householdsMap).forEach(entry => {
      const hhId       = newHouseholdId();
      const formalName = constructFormalName(entry.members);
      households.push({
        id: hhId,
        formalName,
        name2:        "",
        address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "",
        phone:        entry.phone,
        email:        entry.email,
        group:        entry.group,
        status:       mapRsvp(entry.rsvpRaw),
        saveTheDateSent: false, inviteSent: false, thankYouSent: false, accommodationNeeded: false,
        rsvpDate: "", notes: entry.notes,
      });
      entry.members.forEach(m => {
        people.push({
          id: newPersonId(), householdId: hhId,
          firstName: m.firstName, lastName: m.lastName,
          name: `${m.firstName} ${m.lastName}`.trim(),
          title: "", isChild: false, isAttending: null,
          tableId: null, shirtSize: "", pantSize: "",
          mealChoice: "", kosher: false, dietary: "", notes: "",
        });
      });
    });

    return { households, people, errors };
  }

  // ── Household-centric path (SimchaKit template and similar) ──────────────
  const householdsMap = {};
  const people = [];
  const errors = [];

  rows.forEach((row, idx) => {
    try {
      const formalName = get(row, "FormalName");
      const hhId       = get(row, "HouseholdID");
      const hhKey      = hhId || formalName || ("auto_" + idx);

      if (!formalName && !hhId) {
        errors.push({ rowIndex: idx + 2, rawRow: row, message: "Missing household name — row skipped" });
        return;
      }

      if (!householdsMap[hhKey]) {
        const legacyCityStateZip = (row["CityStateZip"] || "").trim();
        const city = get(row, "City") || (legacyCityStateZip && !get(row, "City") ? legacyCityStateZip : "");
        householdsMap[hhKey] = {
          id: newHouseholdId(),
          formalName, name2: get(row, "Name2"),
          address1: get(row, "Address1"), address2: get(row, "Address2"),
          city, stateProvince: get(row, "StateProvince"), postalCode: get(row, "PostalCode"),
          country: get(row, "Country"),
          phone: get(row, "Phone"), email: get(row, "Email"),
          group: get(row, "Group"), status: mapRsvp(get(row, "Status")),
          saveTheDateSent: get(row, "SaveTheDateSent").toLowerCase() === "yes",
          inviteSent:      get(row, "InviteSent").toLowerCase() === "yes",
          thankYouSent:    get(row, "ThankYouSent").toLowerCase() === "yes",
          accommodationNeeded: get(row, "AccommodationNeeded").toLowerCase() === "yes",
          rsvpDate: get(row, "RsvpDate"),
          notes: [get(row, "HouseholdNotes"), get(row, "RsvpComment")].filter(Boolean).join(" | "),
        };
      }

      const firstName  = get(row, "PersonFirstName");
      const lastName   = get(row, "PersonLastName");
      const legacyName = (row["PersonName"] || "").trim();

      if (firstName || lastName || legacyName) {
        people.push({
          id: newPersonId(), householdId: householdsMap[hhKey].id,
          firstName: firstName || (legacyName ? legacyName.split(" ")[0] : ""),
          lastName:  lastName  || (legacyName ? legacyName.split(" ").slice(1).join(" ") : ""),
          name: firstName ? `${firstName} ${lastName}`.trim() : legacyName,
          title: get(row, "Title"),
          isChild: get(row, "IsChild").toLowerCase() === "yes",
          isAttending: get(row, "IsAttending") === "Yes" ? true : get(row, "IsAttending") === "No" ? false : null,
          tableId: null,
          shirtSize: get(row, "ShirtSize"), pantSize: get(row, "PantSize"),
          mealChoice: get(row, "MealChoice"),
          kosher: get(row, "Kosher").toLowerCase() === "yes",
          dietary: get(row, "Dietary"), notes: get(row, "PersonNotes"),
        });
      }
    } catch (err) {
      errors.push({ rowIndex: idx + 2, rawRow: row, message: err.message || "Unexpected error processing row" });
    }
  });

  return { households: Object.values(householdsMap), people, errors };
}

function exportToInvitationCSV(households, people) {
  const headers = ["Last Name","Name","Name 2","Address 1","Address 2","City","State / Province","Postal Code","Country","Household","Adults","Children"];
  const esc = v => { const s=String(v||""); return (s.includes(",")||s.includes('"')) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const rows = [...households].sort((a,b) => {
    const la=(a.formalName||"").split(" ").pop().toLowerCase();
    const lb=(b.formalName||"").split(" ").pop().toLowerCase();
    return la.localeCompare(lb);
  }).map(hh => {
    // Migrate legacy cityStateZip if needed
    const migrated = migrateCityStateZip(hh);
    const c = computeHouseholdCounts(people, hh.id);
    const lastName = (hh.formalName||"").split(" ").pop();
    return [
      lastName, hh.formalName||"", hh.name2||"",
      hh.address1||"", hh.address2||"",
      migrated.city||"", migrated.stateProvince||"", migrated.postalCode||"",
      hh.country||"United States",
      1, c.adults, c.kids
    ];
  });
  return [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
}

// ── Guest export: By Household ───────────────────────────────────────────────
// One row per household. Audience: planner, coordinator, full reference.
function exportGuestsByHousehold(households, people, adminConfig) {
  const timeline = adminConfig?.timeline || [];
  const esc = v => { const s = String(v || ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const headers = [
    "Last Name", "Formal Name", "Name 2", "Group", "RSVP Status",
    "Adults (invited)", "Kids (invited)", "Adults (attending)", "Kids (attending)",
    "Kosher Meals", "Save-the-date sent", "Invitation sent",
    "Sub-events invited to",
    "Address 1", "Address 2", "City", "State / Province", "Postal Code", "Country",
    "Notes"
  ];
  const sorted = [...households].sort((a, b) => {
    const la = (a.formalName || "").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    const lb = (b.formalName || "").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    return la.localeCompare(lb);
  });
  const rows = sorted.map(hh => {
    const migrated = migrateCityStateZip(hh);
    const counts   = computeHouseholdCounts(people, hh.id);
    const attending = getHouseholdAttending(hh, people);
    const lastName  = (hh.formalName || "").trim().split(" ").filter(Boolean).pop() || "";
    const sections  = (hh.eventSections || []).map(id => {
      const entry = timeline.find(e => e.id === id);
      return entry ? (entry.icon ? entry.icon + " " + entry.title : entry.title) : id;
    }).join("; ");
    return [
      lastName, hh.formalName || "", hh.name2 || "",
      hh.group || "", hh.rsvpStatus || "Invited",
      counts.adults, counts.kids,
      attending.adults, attending.kids,
      counts.kosher,
      hh.saveTheDateSent ? "Yes" : "No",
      hh.invitationSent  ? "Yes" : "No",
      sections,
      hh.address1 || "", hh.address2 || "",
      migrated.city || "", migrated.stateProvince || "",
      migrated.postalCode || "", hh.country || "United States",
      hh.notes || ""
    ];
  });
  return [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
}

// ── Guest export: By Person ──────────────────────────────────────────────────
// One row per individual. Audience: catering, favors vendor, day-of staff.
function exportGuestsByPerson(households, people, adminConfig) {
  const timeline = adminConfig?.timeline || [];
  const esc = v => { const s = String(v || ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const headers = [
    "First Name", "Last Name", "Title", "Household", "Group", "RSVP Status",
    "Adult / Child", "Meal Choice", "Kosher", "Dietary Notes",
    "Shirt Size", "Table", "Attending Sub-events"
  ];
  const hhMap = Object.fromEntries(households.map(h => [h.id, h]));
  const sorted = [...people].sort((a, b) => {
    const la = (a.lastName || "").toLowerCase();
    const lb = (b.lastName || "").toLowerCase();
    if (la !== lb) return la.localeCompare(lb);
    return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase());
  });
  const rows = sorted.map(p => {
    const hh      = hhMap[p.householdId] || {};
    const sections = (p.attendingSections || []).map(id => {
      const entry = timeline.find(e => e.id === id);
      return entry ? (entry.icon ? entry.icon + " " + entry.title : entry.title) : id;
    }).join("; ");
    return [
      p.firstName || "", p.lastName || "", p.title || "",
      hh.formalName || hh.name2 || "",
      hh.group || "",
      hh.rsvpStatus || "Invited",
      p.isChild ? "Child" : "Adult",
      p.mealChoice || "",
      p.kosher ? "Yes" : "",
      p.dietary || "",
      p.shirtSize || "",
      p.tableId ? (p.tableId) : "",
      sections
    ];
  });
  return [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
}

// ── Guest export: Printable HTML view ────────────────────────────────────────
// Grouped by group. Audience: day-of binder, door checklist, at-a-glance print.
function generateGuestPrintHTML(households, people, eventName, eventDate, theme) {
  const esc = s => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const palette = theme?.palette || "rose";
  const accent  = palette === "blue"  ? "#3b82f6"
                : palette === "green" ? "#22c55e"
                : palette === "gold"  ? "#d97706"
                : "#b5648f";
  const accentLight = palette === "blue"  ? "#eff6ff"
                    : palette === "green" ? "#f0fdf4"
                    : palette === "gold"  ? "#fffbeb"
                    : "#fef2f7";

  // Sort households by group then last name
  const GROUP_ORDER = ["Family", "Friends", "Sydney's Class", "Gail's Invites", "Other"];
  const sorted = [...households].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group) >= 0 ? GROUP_ORDER.indexOf(a.group) : 99;
    const gb = GROUP_ORDER.indexOf(b.group) >= 0 ? GROUP_ORDER.indexOf(b.group) : 99;
    if (ga !== gb) return ga - gb;
    const la = (a.formalName || "").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    const lb = (b.formalName || "").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    return la.localeCompare(lb);
  });

  // Group households
  const byGroup = {};
  sorted.forEach(hh => {
    const g = hh.group || "Other";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(hh);
  });

  const hhMap = Object.fromEntries(households.map(h => [h.id, h]));
  const peopleByHH = {};
  people.forEach(p => {
    if (!peopleByHH[p.householdId]) peopleByHH[p.householdId] = [];
    peopleByHH[p.householdId].push(p);
  });

  const statusColor = s =>
    s === "RSVP Yes" ? "#16a34a" : s === "RSVP No" ? "#dc2626" :
    s === "Pending"  ? "#d97706" : s === "Maybe"   ? "#7c3aed" : "#6b7280";

  const totalPeople = households.reduce((s, hh) => s + computeHouseholdCounts(people, hh.id).total, 0);
  const rsvpYes     = households.filter(hh => hh.rsvpStatus === "RSVP Yes").length;
  const kosher      = people.filter(p => p.kosher).length;

  const groupSections = Object.entries(byGroup).map(([group, hhs]) => {
    const rows = hhs.map(hh => {
      const counts  = computeHouseholdCounts(people, hh.id);
      const members = (peopleByHH[hh.id] || []);
      const dietary = members.filter(p => p.dietary).map(p => `${esc(p.firstName||p.title||"")}: ${esc(p.dietary)}`).join(" · ");
      const kosherFlag = counts.kosher > 0 ? `<span style="color:#16a34a;font-weight:700">✓ Kosher (${counts.kosher})</span>` : "";
      const memberNames = members.map(p =>
        `<span style="color:#374151">${esc((p.title ? p.title + " " : "") + (p.firstName||"") + " " + (p.lastName||""))}</span>`
      ).join(" · ");
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">${esc(hh.formalName||"")}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${memberNames}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center">
          <span style="color:${statusColor(hh.rsvpStatus||"Invited")};font-weight:700;font-size:12px">${esc(hh.rsvpStatus||"Invited")}</span>
        </td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;text-align:center">${counts.adults}A ${counts.kids > 0 ? counts.kids + "K" : ""}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">${kosherFlag}${dietary ? (kosherFlag ? " · " : "") + dietary : ""}</td>
      </tr>`;
    }).join("");
    return `<div style="margin-bottom:28px">
      <div style="background:${accent};color:white;padding:8px 14px;border-radius:6px 6px 0 0;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">
        ${esc(group)} &nbsp;·&nbsp; ${hhs.length} household${hhs.length !== 1 ? "s" : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:white">
        <thead><tr style="background:${accentLight}">
          <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase">Household</th>
          <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase">Members</th>
          <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase">RSVP</th>
          <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase">Count</th>
          <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase">Dietary</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join("");

  const dateStr = eventDate ? new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" }) : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(eventName||"Guest List")}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#111827; background:#fff; padding:24px; font-size:13px; }
  @media print { body { padding:12px; } .no-print { display:none; } }
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid ${accent}">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:#111827">${esc(eventName||"Guest List")}</h1>
      ${dateStr ? `<div style="font-size:13px;color:#6b7280;margin-top:4px">${esc(dateStr)}</div>` : ""}
    </div>
    <div style="display:flex;gap:16px;text-align:center">
      <div><div style="font-size:22px;font-weight:800;color:${accent}">${households.length}</div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase">Households</div></div>
      <div><div style="font-size:22px;font-weight:800;color:${accent}">${totalPeople}</div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase">People</div></div>
      <div><div style="font-size:22px;font-weight:800;color:#16a34a">${rsvpYes}</div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase">Confirmed</div></div>
      ${kosher > 0 ? `<div><div style="font-size:22px;font-weight:800;color:#16a34a">${kosher}</div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase">Kosher</div></div>` : ""}
    </div>
  </div>
  <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 18px;background:${accent};color:white;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨 Print</button>
  ${groupSections}
  <div style="margin-top:24px;text-align:center;font-size:11px;color:#9ca3af">Generated ${new Date().toLocaleDateString()} · ${esc(eventName||"SimchaKit")}</div>
</body></html>`;
}


export {
  getPeopleForHousehold,
  isMaleTitle,
  computeHouseholdCounts,
  getHouseholdAttending,
  formatPhone,
  parseCSV,
  generateCSVTemplate,
  importCSVToGuestData,
  detectColumnMapping,
  constructFormalName,
  mapRsvp,
  exportToInvitationCSV,
  exportGuestsByHousehold,
  exportGuestsByPerson,
  generateGuestPrintHTML,
  getAddressFields,
  formatAddress,
  migrateCityStateZip,
};
