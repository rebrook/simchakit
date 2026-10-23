// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V4.17.2 — GuestsTab.jsx
// Ported from V2. Households and people via useEventData.
// Audit logging now goes through the shared writeAuditLog (utils/auditLog.js).
// The previous local appendAuditLog wrote action/detail as top-level columns
// that do not exist on the audit_log table (id, event_id, data, created_at,
// updated_at only) and every write silently failed -- no GuestsTab activity
// has ever appeared in the notification panel or activity log until this fix.
// All modals (HouseholdModal, ImportModal, etc.) are props-based — unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { useEventData, peoplePromoteColumns, householdPromoteColumns } from "@/hooks/useEventData.js";
import { writeAuditLog } from "@/utils/auditLog.js";
import { useSearchHighlight } from "@/hooks/useSearchHighlight.js";
import { RSVP_STATUSES, DEFAULT_GROUPS } from "@/constants/guest-constants.js";
import { sortTimeline } from "@/utils/dates.js";
import { getPeopleForHousehold, isMaleTitle, computeHouseholdCounts, getHouseholdAttending, formatAddress, migrateCityStateZip } from "@/utils/guests.js";
import { isInvited, getSubEventStatus, getPersonSectionStatus, resolveMainEvent, getMealPopulation, getAwaitingSummary, describeAwaitingSections, splitAdultsKids } from "@/utils/sections.js";
import { consumeGuestsPreset } from "@/utils/guestsPreset.js";
import { ArchivedNotice } from "@/components/shared/ArchivedNotice.jsx";
import { RsvpPill } from "@/components/shared/RsvpPill.jsx";
import { CateringSummary } from "@/components/shared/CateringSummary.jsx";
import { InfoPopover } from "@/components/shared/InfoPopover.jsx";
import { METRIC_HELP } from "@/constants/metrics.js";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog.jsx";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";
import { useIsMobile } from "@/hooks/useIsMobile.js";
import { printDocument, isTouchPrimary } from "@/utils/printDocument.js";
import { PrintPreviewModal } from "@/components/shared/PrintPreviewModal.jsx";
import { HouseholdModal }      from "@/components/guests/HouseholdModal.jsx";
import { ImportModal }         from "@/components/guests/ImportModal.jsx";
import { TimelineEntryModal }  from "@/components/guests/TimelineEntryModal.jsx";
import { GuestExportModal }    from "@/components/guests/GuestExportModal.jsx";
import { GuestInsights }       from "@/components/guests/GuestInsights.jsx";
import { statusStyle }         from "@/components/guests/statusStyle.js";

// TimelineEntryModal moved to components/guests/; re-exported so AdminPanel's import is unchanged.
export { TimelineEntryModal };


// isInvited() and getSubEventStatus() now live in @/utils/sections.js so
// OverviewTab, DayOfOverlay, and the Print Brief share this exact logic
// instead of each re-deriving their own (previously incorrect) version.

// ── GuestsTab ─────────────────────────────────────────────────────────────────
export function GuestsTab({ eventId, event, adminConfig, showToast, isArchived, isViewer, searchHighlight, clearSearchHighlight, setTopbarSubtitle }) {
  const { items: households, loading: hLoading, save: saveHouseholdRow, remove: removeHouseholdRow } = useEventData(eventId, "households", { promoteColumns: householdPromoteColumns });
  const { items: people,     loading: pLoading, save: savePersonRow,    remove: removePersonRow }     = useEventData(eventId, "people", { promoteColumns: peoplePromoteColumns });
  const { items: tables,     loading: tLoading }                                                       = useEventData(eventId, "tables");

  const groups   = adminConfig?.groups   || DEFAULT_GROUPS;
  const sections = sortTimeline(adminConfig?.timeline || []).map(e => ({ id: e.id, label: (e.icon ? e.icon + " " : "") + e.title, inviteAllByDefault: e.inviteAllByDefault !== false }));

  const [search,               setSearch]               = useState("");
  const [groupFilter,          setGroupFilter]          = useState("All");
  const [statusFilter,         setStatusFilter]         = useState("All");
  const [expandedHH,           setExpandedHH]           = useState(null);
  const [showAdd,              setShowAdd]              = useState(false);
  const [editingHH,            setEditingHH]            = useState(null);
  const [showImport,           setShowImport]           = useState(false);
  const [showGuestExport,      setShowGuestExport]      = useState(false);
  const [guestPrintHTML,       setGuestPrintHTML]       = useState(null);
  const [deleteConfirm,        setDeleteConfirm]        = useState(null);
  const [openRsvp,             setOpenRsvp]             = useState(null);
  const [outOfTownFilter,      setOutOfTownFilter]      = useState(false);
  const [missingAddressFilter, setMissingAddressFilter] = useState(false);
  const [selectedHHIds,        setSelectedHHIds]        = useState(new Set());
  const [bulkStatus,           setBulkStatus]           = useState("RSVP Yes");
  const [mobileChip,           setMobileChip]           = useState("All");
  const [showMoreFilters,      setShowMoreFilters]      = useState(false);
  const [subEventFilter,       setSubEventFilter]       = useState([]);
  const [subEventStatusFilter, setSubEventStatusFilter] = useState("All");
  const [awaitingOnly,         setAwaitingOnly]         = useState(false);
  const [mobileMoreFiltersOpen,setMobileMoreFiltersOpen]= useState(false);
  const [expandedChipRows,     setExpandedChipRows]     = useState(new Set());

  const isMobile = useIsMobile();

  useSearchHighlight(searchHighlight, clearSearchHighlight, "guests", { setExpandedHH });

  useEffect(() => { setSelectedHHIds(new Set()); }, [search, groupFilter, statusFilter, mobileChip, outOfTownFilter, missingAddressFilter, subEventFilter, subEventStatusFilter, awaitingOnly]);

  // V4.41.0: arriving from the Overview timeline's awaiting count opens this
  // tab already filtered to the guests who still owe an answer for that
  // sub-event (one-shot handoff, see utils/guestsPreset.js).
  useEffect(() => {
    const p = consumeGuestsPreset(eventId);
    if (!p) return;
    setSubEventFilter(p.sectionIds);
    setSubEventStatusFilter("All");
    setAwaitingOnly(true);
    setShowMoreFilters(true);
  }, [eventId]);

  // ── RSVP status update ────────────────────────────────────────────────────
  const updateRsvpStatus = async (hhId, newStatus) => {
    if (isArchived) return;
    const hh = households.find(h => h.id === hhId);
    const oldStatus = hh?.rsvpStatus || "";
    await saveHouseholdRow({ ...hh, rsvpStatus: newStatus });
    writeAuditLog(eventId, "households", "Updated", `RSVP updated — ${hh?.formalName || "Household"}: ${oldStatus} → ${newStatus}`);
    showToast(`RSVP updated — ${newStatus}`);
    setOpenRsvp(null);
  };

  // ── Sub-event chip row overflow (+N more) ─────────────────────────────────
  const toggleChipRow = (hhId) => {
    setExpandedChipRows(prev => {
      const next = new Set(prev);
      next.has(hhId) ? next.delete(hhId) : next.add(hhId);
      return next;
    });
  };

  // ── Bulk RSVP update ──────────────────────────────────────────────────────
  const toggleSelect = (hhId) => {
    setSelectedHHIds(prev => {
      const next = new Set(prev);
      next.has(hhId) ? next.delete(hhId) : next.add(hhId);
      return next;
    });
  };

  const applyBulkRsvp = async () => {
    if (isArchived || selectedHHIds.size === 0) return;
    for (const hhId of selectedHHIds) {
      const hh = households.find(h => h.id === hhId);
      if (hh) await saveHouseholdRow({ ...hh, rsvpStatus: bulkStatus });
    }
    writeAuditLog(eventId, "households", "Updated", `Bulk RSVP update — ${selectedHHIds.size} household${selectedHHIds.size !== 1 ? "s" : ""} set to ${bulkStatus}`);
    showToast(`${selectedHHIds.size} household${selectedHHIds.size !== 1 ? "s" : ""} updated to ${bulkStatus}`);
    setSelectedHHIds(new Set());
  };

  // ── Inline mailing toggles ────────────────────────────────────────────────
  const toggleMailing = async (hhId, field) => {
    if (isArchived) return;
    const hh = households.find(h => h.id === hhId);
    if (hh) await saveHouseholdRow({ ...hh, [field]: !hh[field] });
  };

  // ── Save household + members ──────────────────────────────────────────────
  const saveHousehold = async ({ household, people: newPpl }) => {
    if (isArchived) return;
    const isEdit = households.some(h => h.id === household.id);

    // Save household row
    await saveHouseholdRow(household);

    // Remove old people for this household then upsert new ones
    const oldPpl = people.filter(p => p.householdId === household.id);
    for (const p of oldPpl) {
      if (!newPpl.find(np => np.id === p.id)) await removePersonRow(p._rowId);
    }
    for (const p of newPpl) await savePersonRow(p);

    writeAuditLog(eventId, "households", isEdit ? "Updated" : "Added", `${isEdit ? "Updated" : "Added"} household — ${household.formalName || "Household"}`);
    showToast(isEdit ? "Household updated" : "Household added");
    setShowAdd(false);
    setEditingHH(null);
  };

  // ── Delete household ──────────────────────────────────────────────────────
  const deleteHousehold = async (id) => {
    if (isArchived) return;
    const hh = households.find(h => h.id === id);
    // Remove all people for this household
    const hhPeople = people.filter(p => p.householdId === id);
    for (const p of hhPeople) await removePersonRow(p._rowId);
    await removeHouseholdRow(hh._rowId);
    writeAuditLog(eventId, "households", "Deleted", `Deleted household — ${hh?.formalName || "Household"}`);
    showToast("Household deleted");
    setDeleteConfirm(null);
    if (expandedHH === id) setExpandedHH(null);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async ({ households: newHH, people: newPpl }, mode) => {
    if (isArchived) return;
    if (mode === "replace") {
      for (const h of households) await removeHouseholdRow(h._rowId);
      for (const p of people)     await removePersonRow(p._rowId);
    }
    for (const h of newHH)  await saveHouseholdRow(h);
    for (const p of newPpl) await savePersonRow(p);
    writeAuditLog(eventId, "households", "Added", `Imported ${newHH.length} household${newHH.length !== 1 ? "s" : ""} and ${newPpl.length} guest${newPpl.length !== 1 ? "s" : ""} (${mode === "replace" ? "replaced existing list" : "added to existing list"})`);
    showToast("Guest list imported");
    setShowImport(false);
  };

  // ── Attending override clear ──────────────────────────────────────────────
  const clearAttendingOverride = async (hhId) => {
    const hh = households.find(h => h.id === hhId);
    if (hh) await saveHouseholdRow({ ...hh, attendingAdults: null, attendingKids: null });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const mainEvent        = resolveMainEvent(adminConfig?.timeline);
  const totalPeople     = people.length;
  const totalOutOfTown  = households.filter(h => h.outOfTown).length;
  const totalAttending  = households.filter(h => h.rsvpStatus === "RSVP Yes").reduce((s, h) => {
    const a = getHouseholdAttending(h, people, mainEvent?.id);
    return s + a.adults + a.kids;
  }, 0);
  // Kosher meals required uses the same shared population as the Catering
  // Summary and Day-of Mode: confirmed for a meal-serving sub-event, declined
  // guests excluded. Kosher guests still awaiting an answer show as pending.
  const mealPop         = getMealPopulation(households, people, sortTimeline(adminConfig?.timeline || []).filter(e => e.servesMeal));
  const totalKosher     = mealPop.confirmed.filter(p => p.kosher).length;
  const kosherPending   = mealPop.relevant.filter(p => p.kosher).length - totalKosher;
  const totalKippot     = people.filter(p => isMaleTitle(p.title)).length;
  const totalAddresses  = households.filter(h => h.address1).length;
  const totalSTDSent    = households.filter(h => h.saveTheDateSent).length;
  const totalInviteSent = households.filter(h => h.inviteSent).length;
  const rsvpYes         = households.filter(h => h.rsvpStatus === "RSVP Yes").length;
  const rsvpPending     = households.filter(h => h.rsvpStatus === "Invited" || h.rsvpStatus === "Pending").length;

  // Guests who still owe a sub-event answer (V4.41.0). A household can be
  // marked RSVP Yes while individual guests are still unset for one sub-event,
  // which the household count below cannot see. Empty unless guests are
  // tracked one by one for sub-events (see getAwaitingSummary).
  const awaitingSummary = useMemo(
    () => getAwaitingSummary(households, people, sortTimeline(adminConfig?.timeline || [])),
    [households, people, adminConfig?.timeline]
  );
  const awaitingCount  = awaitingSummary.all.length;
  const awaitingTitles = describeAwaitingSections(awaitingSummary.bySection);
  // The banner counts "Maybe" as not yet responded, matching the mobile
  // Pending chip below. rsvpPending (Invited or Pending only) is unchanged.
  const rsvpUnanswered = households.filter(h => h.rsvpStatus === "Invited" || h.rsvpStatus === "Pending" || h.rsvpStatus === "Maybe").length;

  // RSVP deadline banner
  const rsvpDeadline = adminConfig?.rsvpDeadline;
  const rsvpBanner = (() => {
    const guestText = awaitingCount > 0
      ? `${awaitingCount} guest${awaitingCount!==1?"s":""} still need${awaitingCount===1?"s":""} to answer for ${awaitingTitles}`
      : "";
    // With no deadline set, only speak up about guests who still owe a
    // sub-event answer; household-level behavior is unchanged (no banner).
    if (!rsvpDeadline) {
      if (awaitingCount === 0) return null;
      return { cls:"warn", icon:<Icon name="mailCheck" context="inline" />, text: guestText, canShow: true };
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(rsvpDeadline + "T00:00:00");
    const diff  = Math.ceil((due - today) / (1000*60*60*24));
    const allResponded = rsvpUnanswered === 0 && awaitingCount === 0 && households.length > 0;
    if (allResponded) return {
      cls:"done", icon:<Icon name="check" context="inline" />, canShow:false,
      text: awaitingSummary.tracking
        ? "All RSVPs received. No households or guests are still pending."
        : "All RSVPs received. No households are still pending.",
    };
    const householdText = `${rsvpUnanswered} household${rsvpUnanswered!==1?"s":""} ${rsvpUnanswered===1?"hasn't":"haven't"} responded yet`;
    const pendingText = [rsvpUnanswered > 0 || awaitingCount === 0 ? householdText : "", guestText].filter(Boolean).join(" · ");
    const canShow = awaitingCount > 0;
    // Guests still owing an answer is a reason to look even when every household has replied.
    const lift = (cls) => (cls === "info" && canShow && rsvpUnanswered === 0) ? "warn" : cls;
    if (diff < 0)  return { cls:lift("urgent"), canShow, icon:<Icon name="alertTriangle" context="inline" />, text:`RSVP deadline passed ${Math.abs(diff)} day${Math.abs(diff)!==1?"s":""} ago · ${pendingText}` };
    if (diff === 0) return { cls:lift("urgent"), canShow, icon:<Icon name="alertTriangle" context="inline" />, text:`RSVP deadline is today · ${pendingText}` };
    if (diff <= 7)  return { cls:lift("urgent"), canShow, icon:<Icon name="alertTriangle" context="inline" />, text:`RSVP deadline in ${diff} day${diff!==1?"s":""} · ${pendingText}` };
    if (diff <= 14) return { cls:lift("warn"),   canShow, icon:<Icon name="mailCheck" context="inline" />, text:`RSVP deadline in ${diff} days · ${pendingText}` };
    return               { cls:lift("info"),   canShow, icon:<Icon name="mailCheck" context="inline" />, text:`RSVP deadline in ${diff} days · ${pendingText}` };
  })();

  // Renders banner text with counts in bold. Built as JSX (not injected HTML)
  // because the text can now include sub-event titles, which are user-entered.
  const boldCounts = (text) => text.split(/(\d+ (?:households?|days?|guests?))/g).map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);

  // ── Mobile chip status mapping ─────────────────────────────────────────
  // Confirmed = RSVP Yes, Pending = Invited+Pending+Maybe, Declined = RSVP No
  const chipStatusMatch = (hhStatus, chip) => {
    if (chip === "All") return true;
    if (chip === "Confirmed") return hhStatus === "RSVP Yes";
    if (chip === "Declined")  return hhStatus === "RSVP No";
    if (chip === "Pending")   return hhStatus === "Invited" || hhStatus === "Pending" || hhStatus === "Maybe";
    return true;
  };
  const chipCounts = useMemo(() => ({
    All:       households.length,
    Confirmed: households.filter(h => h.rsvpStatus === "RSVP Yes").length,
    Pending:   households.filter(h => h.rsvpStatus === "Invited" || h.rsvpStatus === "Pending" || h.rsvpStatus === "Maybe").length,
    Declined:  households.filter(h => h.rsvpStatus === "RSVP No").length,
  }), [households]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  // Sort key per household: the alphabetically-lowest real surname among its
  // linked people, not a parse of the free-text formalName label -- the label
  // can join two different surnames ("... and ..."), use a generic word like
  // "Family", or list members in a different order than their surname would
  // sort in, any of which broke a naive "last word of the label" sort.
  const hhSortKey = Object.fromEntries(households.map(hh => {
    const lastNames = getPeopleForHousehold(people, hh.id)
      .map(p => (p.lastName || (p.name||"").split(" ").pop() || "").toLowerCase())
      .filter(Boolean)
      .sort();
    const key = lastNames[0] || (hh.formalName||"").trim().split(" ").filter(Boolean).pop()?.toLowerCase() || "";
    return [hh.id, key];
  }));

  const filtered = households.filter(hh => {
    if (groupFilter  !== "All" && hh.group  !== groupFilter)  return false;
    // Desktop uses statusFilter select; mobile uses mobileChip
    if (isMobile) {
      if (!chipStatusMatch(hh.rsvpStatus, mobileChip)) return false;
    } else {
      if (statusFilter !== "All" && hh.rsvpStatus !== statusFilter) return false;
    }
    if (outOfTownFilter      && !hh.outOfTown) return false;
    if (missingAddressFilter &&  hh.address1)  return false;
    if (subEventFilter.length > 0) {
      const hhMembers = getPeopleForHousehold(people, hh.id);
      // ANY selected sub-event matching the chosen status is a match — this
      // surfaces "who still needs a nudge on any of these events" rather than
      // requiring every selected sub-event to match, which would hide anyone
      // who responded to some but not all of the selected sub-events.
      const matchesAny = subEventFilter.some(sid => {
        const sec = sections.find(x => x.id === sid);
        if (!sec) return false;
        const st = getSubEventStatus(hh, hhMembers, sec);
        if (st === null) return false;
        return subEventStatusFilter === "All" ? true : st === subEventStatusFilter;
      });
      if (!matchesAny) return false;
    }
    if (awaitingOnly) {
      // Person-level: keep households with at least one invited member whose own
      // answer is still TBD for a selected sub-event (all sub-events if none are
      // selected). The household-level sub-event status above cannot see this.
      const hhMembers = getPeopleForHousehold(people, hh.id);
      const scopeIds  = subEventFilter.length > 0 ? subEventFilter : sections.map(x => x.id);
      const hasAwaiting = scopeIds.some(sid => {
        const sec = sections.find(x => x.id === sid);
        return !!sec && isInvited(hh, sec) && hhMembers.some(p => getPersonSectionStatus(p, sec) === "TBD");
      });
      if (!hasAwaiting) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const memberMatch = getPeopleForHousehold(people, hh.id).some(p => {
        const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
        return fullName.toLowerCase().includes(s);
      });
      if (!(hh.formalName||"").toLowerCase().includes(s) && !memberMatch) return false;
    }
    return true;
  }).sort((a, b) => (hhSortKey[a.id]||"").localeCompare(hhSortKey[b.id]||""));

  // ── Awaiting list (V4.41.0) ────────────────────────────────────────────────
  // The names behind the banner's guest count, shown while the awaiting filter
  // is on. One row per guest, with every selected sub-event they still owe.
  const awaitingRows = (() => {
    if (!awaitingOnly) return [];
    const byPerson = new Map();
    awaitingSummary.bySection
      .filter(b => subEventFilter.length === 0 || subEventFilter.includes(b.section.id))
      .forEach(b => b.people.forEach(p => {
        const entry = byPerson.get(p.id) || { person: p, titles: [] };
        entry.titles.push(b.section.title || "Sub-event");
        byPerson.set(p.id, entry);
      }));
    const hhById = new Map(households.map(h => [h.id, h]));
    return [...byPerson.values()]
      .map(e => ({
        ...e,
        hh:   hhById.get(e.person.householdId) || null,
        name: [e.person.firstName, e.person.lastName].filter(Boolean).join(" ") || e.person.name || "Unnamed guest",
      }))
      .sort((a, b) => (hhSortKey[a.hh?.id]||"").localeCompare(hhSortKey[b.hh?.id]||"") || a.name.localeCompare(b.name));
  })();
  const awaitingSplit = splitAdultsKids(awaitingRows.map(r => r.person));

  // Clears every other filter first so nobody is hidden by a leftover search,
  // group, or status choice, then narrows to the sub-events with open answers.
  const showAwaiting = () => {
    setSearch(""); setGroupFilter("All"); setStatusFilter("All"); setMobileChip("All");
    setOutOfTownFilter(false); setMissingAddressFilter(false);
    setSubEventFilter(awaitingSummary.bySection.map(b => b.section.id));
    setSubEventStatusFilter("All");
    setAwaitingOnly(true);
    setShowMoreFilters(true);
  };
  const clearAwaiting = () => {
    setAwaitingOnly(false);
    setSubEventFilter([]);
    setSubEventStatusFilter("All");
  };
  const jumpToHousehold = (hhId) => {
    if (!hhId) return;
    setExpandedHH(hhId);
    setTimeout(() => document.getElementById(`row-${hhId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  // ── Sub-event row chips (glance-level, read-only) ──────────────────────────
  // Hidden entirely for events with 0-1 sub-events — a single sub-event would
  // just duplicate the main RSVP pill already shown on the row. Only shows a
  // chip when it's actually informative: a real RSVP Yes/No response, or any
  // opt-in-only sub-event (being invited to one of those is itself notable,
  // regardless of status). A default-all sub-event still sitting at Invited or
  // Pending is the same non-answer as every other household, so it stays
  // hidden rather than repeating identical noise on every single row.
  // Rendered as its own full-width block below the main row (not inline in the
  // single-line meta row), so it wraps onto additional lines instead of
  // stretching that row out sideways when a household has several chips.
  const subEventGlyph = { "RSVP Yes": "✓", "RSVP No": "✕" };
  const subEventTone   = (status) => status === "RSVP Yes" ? "tag-green" : status === "RSVP No" ? "tag-red" : "tag-gold";
  const renderSubEventChips = (hh, hhMembers, isRowExpanded, onToggleRow) => {
    if (sections.length <= 1) return null;
    const notable = sections
      .map(s => ({ ...s, status: getSubEventStatus(hh, hhMembers, s) }))
      .filter(s => s.status !== null)
      .filter(s => s.inviteAllByDefault === false || s.status === "RSVP Yes" || s.status === "RSVP No");
    if (notable.length === 0) return null;
    const visible = isRowExpanded ? notable : notable.slice(0, 4);
    const hiddenCount = notable.length - visible.length;
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap:4,padding:"0 14px 10px 14px"}} onClick={e=>e.stopPropagation()}>
        {visible.map(s => (
          <span key={s.id} className={`tag ${subEventTone(s.status)}`} style={{fontSize:10,cursor:"default"}}
            title={`${s.label}: ${s.status}`}>
            {subEventGlyph[s.status] || "•"} {s.label}
          </span>
        ))}
        {hiddenCount > 0 && (
          <button className="tag tag-muted" style={{fontSize:10,border:"none",cursor:"pointer"}}
            title="Show all sub-events for this household"
            onClick={()=>onToggleRow(hh.id)}>
            +{hiddenCount} more
          </button>
        )}
      </div>
    );
  };

  // ── Topbar subtitle (must be before loading guard — hooks can't follow conditional returns) ──
  const subtitle = `${households.length} household${households.length!==1?"s":""} · ${totalPeople} individual${totalPeople!==1?"s":""}`;
  useEffect(() => {
    setTopbarSubtitle(subtitle);
    return () => setTopbarSubtitle(null);
  }, [subtitle, setTopbarSubtitle]);

  if (hLoading || pLoading) return <div style={loadingStyle}>Loading guests…</div>;

  return (
    <div>
      {isArchived && <ArchivedNotice />}

      {/* Mobile subtitle (≤900px only, where topbar is hidden) */}
      <div className="mobile-tab-subtitle">{subtitle}</div>

      {/* Action row */}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <button className="btn btn-secondary btn-sm" onClick={()=>setShowGuestExport(true)}>↓ Export Guests</button>
        {!isViewer && (
          <>
            <button className="btn btn-secondary btn-sm" disabled={isArchived} onClick={()=>setShowImport(true)}>Import</button>
            <button className="btn btn-primary btn-sm" disabled={isArchived} onClick={()=>setShowAdd(true)}>+ Add Household</button>
          </>
        )}
      </div>

      {rsvpBanner && (
        <div className={`rsvp-banner ${rsvpBanner.cls}`}>
          <span className="rsvp-banner-icon">{rsvpBanner.icon}</span>
          <span>{boldCounts(rsvpBanner.text)}</span>
          {rsvpBanner.canShow && !awaitingOnly && (
            <button type="button" className="rsvp-banner-action" onClick={showAwaiting}>Show them</button>
          )}
        </div>
      )}

      {awaitingOnly && (
        <div className="awaiting-panel">
          <div className="awaiting-panel-head">
            <div>
              <div className="awaiting-panel-title">
                {awaitingRows.length === 0
                  ? "No one is awaiting an answer"
                  : `Still waiting on ${awaitingRows.length} guest${awaitingRows.length!==1?"s":""}`}
              </div>
              {awaitingRows.length > 0 && (
                <div className="awaiting-panel-sub">
                  {awaitingSplit.adults} adult{awaitingSplit.adults!==1?"s":""}, {awaitingSplit.kids} kid{awaitingSplit.kids!==1?"s":""}. Tap a name to open the household.
                </div>
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAwaiting}>Clear filter</button>
          </div>
          {awaitingRows.length > 0 && (
            <ul className="awaiting-panel-list">
              {awaitingRows.map(r => (
                <li key={r.person.id}>
                  <button type="button" className="awaiting-panel-row" onClick={() => jumpToHousehold(r.hh?.id)}>
                    <span className="awaiting-panel-name">{r.name}</span>
                    <span className={`tag ${r.person.isChild ? "tag-blue" : "tag-muted"}`}>{r.person.isChild ? "Child" : "Adult"}</span>
                    <span className="awaiting-panel-hh">{r.hh?.formalName || ""}</span>
                    {r.hh && (
                      <span className="awaiting-panel-status" style={{ background: statusStyle[r.hh.rsvpStatus]?.bg, color: statusStyle[r.hh.rsvpStatus]?.color }}>
                        {r.hh.rsvpStatus || "Invited"}
                      </span>
                    )}
                    <span className="awaiting-panel-secs">{r.titles.join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",marginBottom:20}}>
        {[
          { label:"Total Guests",   value:totalPeople,    sub:`${households.length} households, everyone on the list`, cls:"stat-accent" },
          { label:"Attending",      value:totalAttending, sub:`at ${mainEvent?.title || "the main event"}`,    cls:"stat-green",
            info: METRIC_HELP.attending({ eventTitle: mainEvent?.title, rsvpYesHouseholds: rsvpYes }) },
          { label:"Out of Town",    value:totalOutOfTown, sub:"hotel block needed",                            cls:"stat-gold"   },
          { label:"STD Sent",       value:`${totalSTDSent}/${households.length}`,  sub:"save the dates",
            cls: totalSTDSent===households.length && households.length>0 ? "stat-green" : "" },
          { label:"Invites Sent",   value:`${totalInviteSent}/${households.length}`, sub:"invitations mailed",
            cls: totalInviteSent===households.length && households.length>0 ? "stat-green" : "" },
          { label:"Kippot Needed",  value:totalKippot,    sub:"males on guest list",                          cls:"stat-accent" },
          { label:"Kosher Meals",   value:totalKosher,    sub:kosherPending>0 ? `required, ${kosherPending} pending` : "required", cls:"",
            info: METRIC_HELP.kosher({ pending: kosherPending }) },
          { label:"Addresses",      value:`${totalAddresses}/${households.length}`, sub:"complete",
            cls: totalAddresses===households.length ? "stat-green" : "stat-red" },
        ].map(s=>(
          <div className="stat-card" key={s.label} style={s.info ? { position: "relative" } : undefined}>
            <div className="stat-label" style={s.info ? { paddingRight: 22 } : undefined}>{s.label}</div>
            <div className={`stat-value ${s.cls}`}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
            {s.info && <InfoPopover text={s.info} style={{ position: "absolute", top: 10, right: 10 }} />}
          </div>
        ))}
      </div>

      <CateringSummary people={people} households={households} adminConfig={adminConfig} />
      <GuestInsights households={households} people={people} groups={groups} statusStyle={statusStyle} />

      {/* Filters */}
      {isMobile ? (
        <div className="guest-mobile-filters">
          <div className="guest-mobile-filters-top">
            <input className="form-input" style={{flex:1,padding:"10px 12px",fontSize:15}} type="text"
              placeholder="Search by name..." value={search} onChange={e=>setSearch(e.target.value)} />
            {!isViewer && (
              <button className="btn btn-primary guest-mobile-add-btn" disabled={isArchived} onClick={()=>setShowAdd(true)}>
                <Icon name="plus" context="inline" />
              </button>
            )}
          </div>
          <div className="guest-mobile-chips">
            {["All","Confirmed","Pending","Declined"].map(chip => {
              const count = chipCounts[chip];
              const isActive = mobileChip === chip;
              const toneClass = chip === "Confirmed" ? "chip-confirmed" : chip === "Pending" ? "chip-pending" : chip === "Declined" ? "chip-declined" : "";
              return (
                <button key={chip}
                  className={`guest-chip ${isActive ? `guest-chip-active ${toneClass}` : ""}`}
                  onClick={() => setMobileChip(chip)}>
                  {chip} {count}
                </button>
              );
            })}
            {sections.length > 1 && (
              <button className={`guest-chip ${subEventFilter.length>0?"guest-chip-active":""}`}
                onClick={()=>setMobileMoreFiltersOpen(true)}>
                Sub-Events{subEventFilter.length>0?` (${subEventFilter.length})`:""}
              </button>
            )}
          </div>
          <select className="form-select" style={{padding:"10px 12px",fontSize:14}} value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
            <option value="All">All Groups</option>
            {groups.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isArchived && !isViewer && filtered.length > 0 && (
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",flexShrink:0,padding:"0 4px"}}
                title={selectedHHIds.size===filtered.length?"Deselect all":"Select all visible"}>
                <input type="checkbox"
                  checked={filtered.length>0 && selectedHHIds.size===filtered.length}
                  ref={el => { if (el) el.indeterminate = selectedHHIds.size>0 && selectedHHIds.size<filtered.length; }}
                  onChange={e => { if (e.target.checked) setSelectedHHIds(new Set(filtered.map(h=>h.id))); else setSelectedHHIds(new Set()); }}
                  style={{width:15,height:15,accentColor:"var(--accent-primary)",cursor:"pointer"}} />
                <span style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>Select All</span>
              </label>
            )}
            <input className="form-input" style={{flex:1,padding:"8px 12px"}} type="text"
              placeholder="Search by name..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <select className="form-select" style={{flex:1,padding:"8px 12px"}} value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
              <option value="All">All Groups</option>
              {groups.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
            <select className="form-select" style={{flex:1,padding:"8px 12px"}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <button className={`btn btn-sm ${outOfTownFilter?"btn-primary":"btn-secondary"}`} title="Show out-of-town households only" onClick={()=>setOutOfTownFilter(f=>!f)}><Icon name="accommodations" context="badge" style={{ marginRight: 4 }} /> Out of Town{outOfTownFilter?<> <Icon name="check" context="badge" /></>:""}</button>
            <button className={`btn btn-sm ${missingAddressFilter?"btn-primary":"btn-secondary"}`} title="Show households missing a mailing address" onClick={()=>setMissingAddressFilter(f=>!f)}><Icon name="mailX" context="badge" style={{ marginRight: 4 }} /> No Address{missingAddressFilter?<> <Icon name="check" context="badge" /></>:""}</button>
            {sections.length > 1 && (
              <button className={`btn btn-sm ${subEventFilter.length>0?"btn-primary":"btn-secondary"}`}
                onClick={()=>setShowMoreFilters(v=>!v)} aria-expanded={showMoreFilters}>
                More Filters{subEventFilter.length>0?` (${subEventFilter.length})`:""} {showMoreFilters ? <Icon name="chevronUp" context="inline" /> : <Icon name="chevronDown" context="inline" />}
              </button>
            )}
          </div>
          {showMoreFilters && sections.length > 1 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:"10px 12px",background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)"}}>
              <span style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginRight:2}}>Sub-Events</span>
              {sections.map(s=>(
                <button key={s.id}
                  className={`guest-chip ${subEventFilter.includes(s.id)?"guest-chip-active":""}`}
                  onClick={()=>setSubEventFilter(f=>f.includes(s.id)?f.filter(x=>x!==s.id):[...f,s.id])}>
                  {s.label}
                </button>
              ))}
              <select className="form-select" style={{width:"auto",padding:"6px 10px",fontSize:12}}
                value={subEventStatusFilter} onChange={e=>setSubEventStatusFilter(e.target.value)}
                disabled={subEventFilter.length===0}
                title={subEventFilter.length===0 ? "Select a sub-event first" : "Filter by RSVP status within selected sub-events"}>
                <option value="All">Any status</option>
                {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              {(subEventFilter.length>0 || subEventStatusFilter!=="All") && (
                <button className="btn btn-ghost btn-sm" onClick={()=>{setSubEventFilter([]);setSubEventStatusFilter("All");}}>Clear</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedHHIds.size > 0 && !isViewer && (
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",marginBottom:8,background:"var(--accent-light)",border:"1px solid var(--accent-medium)",borderRadius:"var(--radius-md)"}}>
          <span style={{fontSize:13,fontWeight:600,color:"var(--accent-primary)",flex:1}}>{selectedHHIds.size} household{selectedHHIds.size!==1?"s":""} selected</span>
          <select className="form-select" value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{fontSize:13,padding:"6px 10px",width:"auto"}} disabled={isArchived}>
            {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={applyBulkRsvp} disabled={isArchived}>Apply</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedHHIds(new Set())}>Clear</button>
        </div>
      )}

      {/* List */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"60px 24px",color:"var(--text-muted)"}}>
          <div style={{fontSize:36,marginBottom:12}}><Icon name="guests" context="empty" /></div>
          <div style={{fontFamily:"var(--font-display)",fontSize:18,marginBottom:8}}>
            {households.length===0 ? "No guests yet"
              : isMobile && mobileChip !== "All" ? `No ${mobileChip.toLowerCase()} households`
              : "No guests match your filters"}
          </div>
          <div style={{fontSize:13,marginBottom:households.length===0?20:0}}>
            {households.length===0 ? "Add your first household or import from CSV."
              : isMobile && mobileChip !== "All" ? "Try a different status or clear your search."
              : "Try adjusting your search or filters."}
          </div>
          {households.length===0 && !isArchived && !isViewer && (
            <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Household</button>
          )}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:6}} onClick={()=>{ if(openRsvp) setOpenRsvp(null); }}>
          {filtered.map(hh => {
            const members    = getPeopleForHousehold(people, hh.id);
            const counts     = computeHouseholdCounts(people, hh.id);
            const isExpanded = expandedHH===hh.id;
            return (
              <div key={hh.id} id={`row-${hh.id}`} style={{background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-sm)",position:"relative"}}>
                <div className="hh-row-main"
                  style={{borderRadius: isExpanded ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)"}}
                  onClick={()=>setExpandedHH(isExpanded?null:hh.id)}>
                  {!isArchived && !isViewer && (
                    <div style={{flexShrink:0,display:"flex",alignItems:"center",paddingRight:4}}>
                      <input type="checkbox" checked={selectedHHIds.has(hh.id)}
                        onClick={e=>e.stopPropagation()} onChange={()=>toggleSelect(hh.id)}
                        style={{width:14,height:14,accentColor:"var(--accent-primary)",cursor:"pointer"}} />
                    </div>
                  )}
                  <div style={{color:"var(--text-muted)",fontSize:12,flexShrink:0,width:16,textAlign:"center"}}>{isExpanded ? <Icon name="chevronDown" context="inline" /> : <Icon name="chevronRight" context="inline" />}</div>
                  <div className="hh-row-name">
                    <div className="hh-row-name-primary">{hh.formalName}</div>
                    {hh.name2 && <div className="hh-row-name-secondary">{hh.name2}</div>}
                    <div className="hh-row-mobile-meta">
                      <span className="tag tag-muted">{hh.group}</span>
                      <RsvpPill value={hh.rsvpStatus} open={openRsvp===hh.id}
                        onOpen={e=>{e.stopPropagation();if(!isViewer)setOpenRsvp(openRsvp===hh.id?null:hh.id);}}
                        onSelect={s=>!isViewer && updateRsvpStatus(hh.id,s)} statusStyle={statusStyle} />
                      {hh.outOfTown && <span title="Out of town" style={{fontSize:13}}><Icon name="accommodations" context="badge" /></span>}
                      {!hh.address1 && <span title="No address on file" style={{fontSize:13}}><Icon name="mailX" context="badge" /></span>}
                      <span style={{fontSize:12,color:"var(--text-muted)"}} title={`${counts.adults} Adults, ${counts.kids} Kids`}>
                        {counts.adults>0 && `${counts.adults}A `}{counts.kids>0 && `${counts.kids}K`}{counts.total===0 && "no members"}
                      </span>
                    </div>
                  </div>
                  <div className="hh-row-meta">
                    <span className="tag tag-muted">{hh.group}</span>
                    <RsvpPill value={hh.rsvpStatus} open={openRsvp===hh.id}
                      onOpen={e=>{e.stopPropagation();if(!isViewer)setOpenRsvp(openRsvp===hh.id?null:hh.id);}}
                      onSelect={s=>!isViewer && updateRsvpStatus(hh.id,s)} statusStyle={statusStyle} />
                    <div className="hh-row-counts" title={`${counts.adults} Adults, ${counts.kids} Kids`}>
                      {counts.adults>0 && <span>{counts.adults}A </span>}
                      {counts.kids>0   && <span>{counts.kids}K </span>}
                      {counts.total===0 && <span style={{fontStyle:"italic"}}>no members</span>}
                    </div>
                    <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>!isViewer && toggleMailing(hh.id,"saveTheDateSent")} title={hh.saveTheDateSent?"Save the Date sent — click to undo":"Mark Save the Date as sent"}
                        style={{width:26,height:26,borderRadius:6,cursor:isViewer?"default":"pointer",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center",border:hh.saveTheDateSent?"none":"1.5px solid var(--border-strong)",background:hh.saveTheDateSent?"var(--accent-primary)":"var(--bg-surface)",color:hh.saveTheDateSent?"white":"var(--text-muted)",transition:"all var(--transition)",opacity:isViewer?0.6:1}}><Icon name="calendar" context="badge" /></button>
                      <button onClick={()=>!isViewer && toggleMailing(hh.id,"inviteSent")} title={hh.inviteSent?"Invite sent — click to undo":"Mark invite as sent"}
                        style={{width:26,height:26,borderRadius:6,cursor:isViewer?"default":"pointer",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center",border:hh.inviteSent?"none":"1.5px solid var(--border-strong)",background:hh.inviteSent?"var(--accent-primary)":"var(--bg-surface)",color:hh.inviteSent?"white":"var(--text-muted)",transition:"all var(--transition)",opacity:isViewer?0.6:1}}><Icon name="mail" context="badge" /></button>
                      {hh.accommodationNeeded && <span title="Accommodation needed" style={{fontSize:14}}><Icon name="hotel" context="badge" /></span>}
                      {hh.outOfTown       && <span title="Out of town"        style={{fontSize:14}}><Icon name="accommodations" context="badge" /></span>}
                      {!hh.address1       && <span title="No address on file" style={{fontSize:14}}><Icon name="mailX" context="badge" /></span>}
                    </div>
                  </div>
                  <div className="hh-row-actions" onClick={e=>e.stopPropagation()}>
                    <button className="icon-btn" title="Edit" aria-label="Edit" disabled={isArchived || isViewer} onClick={()=>setEditingHH(hh)}><Icon name="pencil" context="inline" /></button>
                    <button className="icon-btn" style={{color:"var(--red)"}} title="Delete" aria-label="Delete" disabled={isArchived || isViewer} onClick={()=>setDeleteConfirm(hh.id)}><Icon name="trash2" context="inline" /></button>
                  </div>
                </div>

                {renderSubEventChips(hh, members, expandedChipRows.has(hh.id), toggleChipRow)}

                {isExpanded && (
                  <div style={{borderTop:"1px solid var(--border)",background:"var(--bg-subtle)",padding:"12px 14px 16px 14px",borderRadius:"0 0 var(--radius-md) var(--radius-md)"}}>
                    <div style={{display:"flex",gap:24,flexWrap:"wrap",marginBottom:12}}>
                      {(hh.address1 || hh.city) && <div style={{fontSize:12,color:"var(--text-secondary)"}}><span style={{color:"var(--text-muted)",marginRight:4}}><Icon name="mapPin" context="badge" /></span>{formatAddress(migrateCityStateZip(hh))}</div>}
                      {hh.phone && <div style={{fontSize:12,color:"var(--text-secondary)"}}><span style={{color:"var(--text-muted)",marginRight:4}}><Icon name="phone" context="badge" /></span>{hh.phone}</div>}
                      {hh.email && <div style={{fontSize:12,color:"var(--text-secondary)"}}><span style={{color:"var(--text-muted)",marginRight:4}}><Icon name="mail" context="badge" /></span>{hh.email}</div>}
                    </div>
                    {(hh.attendingAdults != null || hh.attendingKids != null) && (
                      <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)",padding:"6px 10px",marginBottom:10,fontSize:12,color:"var(--green)",fontWeight:600}}>
                        <span><Icon name="check" context="badge" /></span>
                        <span>Attending override set:{hh.attendingAdults!=null&&` ${hh.attendingAdults} adult${hh.attendingAdults!==1?"s":""}`}{hh.attendingAdults!=null&&hh.attendingKids!=null&&","}{hh.attendingKids!=null&&` ${hh.attendingKids} kid${hh.attendingKids!==1?"s":""}`}</span>
                        <button style={{marginLeft:"auto",fontSize:11,background:"none",border:"none",color:"var(--green)",cursor:"pointer",fontWeight:700,padding:0}}
                          onClick={()=>clearAttendingOverride(hh.id)}>Clear override</button>
                      </div>
                    )}
                    {members.length>0 ? (
                      isMobile ? (
                        <div className="member-card-list">
                          {members.map(p => {
                            const name = [p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"Unknown";
                            const hasSizes = p.shirtSize || p.pantSize;
                            const hasDiet = p.mealChoice || p.kosher || p.dietary;
                            return (
                              <div key={p.id} className="member-card">
                                <div className="member-card-header">
                                  <span className="member-card-name">{name}</span>
                                  <span className={`tag ${p.isChild ? "tag-blue" : "tag-muted"}`}>{p.isChild ? "Child" : "Adult"}</span>
                                  {p.title && <span className="tag tag-muted">{p.title}</span>}
                                </div>
                                {(() => {
                                  const invitedSecs = sections.filter(s => isInvited(hh, s));
                                  const yes = invitedSecs.filter(s => getPersonSectionStatus(p, s) === "Yes");
                                  const no  = invitedSecs.filter(s => getPersonSectionStatus(p, s) === "No");
                                  // V4.41.0: when guests are tracked one by one, also flag the sub-events
                                  // this person has not answered yet (they were invisible next to a Yes).
                                  const tbd = awaitingSummary.tracking ? invitedSecs.filter(s => getPersonSectionStatus(p, s) === "TBD") : [];
                                  if (yes.length === 0 && no.length === 0) {
                                    return <div className="member-card-sections"><span className="tag tag-muted" style={{fontSize:10}}>Sub-events TBD</span></div>;
                                  }
                                  return (
                                    <div className="member-card-sections">
                                      {yes.map(s => <span key={s.id} className="tag tag-green" style={{fontSize:10}}>{s.label}</span>)}
                                      {no.map(s => <span key={s.id} className="tag tag-red" style={{fontSize:10}}>{s.label} — No</span>)}
                                      {tbd.map(s => <span key={s.id} className="tag tag-muted" style={{fontSize:10}}>{s.label}: TBD</span>)}
                                    </div>
                                  );
                                })()}
                                {hasDiet && (
                                  <div className="member-card-detail">
                                    {p.mealChoice && <span><Icon name="utensils" context="badge" style={{marginRight:3}} />{p.mealChoice}</span>}
                                    {p.kosher && <span className="tag tag-accent" style={{fontSize:10}}>Kosher</span>}
                                    {p.dietary && <span style={{color:"var(--text-muted)",fontStyle:"italic"}}>{p.dietary}</span>}
                                  </div>
                                )}
                                {hasSizes && (
                                  <div className="member-card-detail">
                                    {p.shirtSize && <span>Shirt: {p.shirtSize}</span>}
                                    {p.pantSize && <span>Pant: {p.pantSize}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{borderBottom:"1px solid var(--border)"}}>
                                {[{label:"Name",align:"left"},{label:"Title",align:"left"},{label:"Age",align:"left"},{label:"Sub-Events",align:"left"},{label:"Shirt",align:"left"},{label:"Pant",align:"left"},{label:"Meal",align:"left"},{label:"Kosher",align:"center"},{label:"Dietary",align:"left"}].map(col=>(
                                  <th key={col.label} style={{padding:"5px 10px",textAlign:col.align,fontWeight:700,color:"var(--text-muted)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{col.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {members.map(p=>(
                                <tr key={p.id} style={{borderBottom:"1px solid var(--border)"}}>
                                  <td style={{padding:"6px 10px",fontWeight:600,color:"var(--text-primary)"}}>{[p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"—"}</td>
                                  <td style={{padding:"6px 10px",color:"var(--text-secondary)"}}>{p.title||"—"}</td>
                                  <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.isChild?"Child":"Adult"}</td>
                                  <td style={{padding:"6px 10px"}}>
                                    {(() => {
                                      const invitedSecs = sections.filter(s => isInvited(hh, s));
                                      const yes = invitedSecs.filter(s => getPersonSectionStatus(p, s) === "Yes");
                                      const no  = invitedSecs.filter(s => getPersonSectionStatus(p, s) === "No");
                                      const tbd = awaitingSummary.tracking ? invitedSecs.filter(s => getPersonSectionStatus(p, s) === "TBD") : [];
                                      if (yes.length === 0 && no.length === 0) return <span className="tag tag-muted">TBD</span>;
                                      return (<>
                                        {yes.map(s => <span key={s.id} className="tag tag-green" style={{marginRight:2,fontSize:10}}>{s.label}</span>)}
                                        {no.map(s => <span key={s.id} className="tag tag-red" style={{marginRight:2,fontSize:10}}>{s.label} — No</span>)}
                                        {tbd.map(s => <span key={s.id} className="tag tag-muted" style={{marginRight:2,fontSize:10}}>{s.label}: TBD</span>)}
                                      </>);
                                    })()}
                                  </td>
                                  <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.shirtSize||"—"}</td>
                                  <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.pantSize||"—"}</td>
                                  <td style={{padding:"6px 10px",color:"var(--text-muted)"}}>{p.mealChoice||"—"}</td>
                                  <td style={{padding:"6px 10px",textAlign:"center"}}>{p.kosher?<Icon name="check" context="badge" />:""}</td>
                                  <td style={{padding:"6px 10px",color:"var(--text-muted)",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.dietary||"—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      <div style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>No members added. Edit this household to add individuals.</div>
                    )}
                    {hh.notes && <div style={{marginTop:10,fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>Note: {hh.notes}</div>}
                    {(hh.contactLog||[]).length>0 && (() => {
                      const CONTACT_TYPE_COLORS = {"Call":{bg:"var(--blue-light)",color:"var(--blue)"},"Text":{bg:"var(--green-light)",color:"var(--green)"},"Email":{bg:"var(--green-light)",color:"var(--green)"},"In Person":{bg:"var(--accent-light)",color:"var(--accent-primary)"},"Other":{bg:"var(--bg-subtle)",color:"var(--text-muted)"}};
                      const sorted = [...(hh.contactLog||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                      const fmt = d => d ? new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
                      return (
                        <div style={{marginTop:12,borderTop:"1px solid var(--border)",paddingTop:10}}>
                          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Contact Log</div>
                          <div style={{display:"flex",flexDirection:"column"}}>
                            {sorted.map((c,i)=>{const tc=CONTACT_TYPE_COLORS[c.type]||CONTACT_TYPE_COLORS["Other"];return(<div key={c.id} style={{padding:"8px 0",borderBottom:i<sorted.length-1?"1px solid var(--border)":"none",fontSize:13}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:c.notes?5:0}}><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,flexShrink:0,background:tc.bg,color:tc.color}}>{c.type}</span><span style={{fontSize:12,color:"var(--text-muted)",fontWeight:500}}>{fmt(c.date)}</span></div>{c.notes&&<div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.6,paddingLeft:2}}>{c.notes}</div>}</div>);})}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {(showAdd||editingHH) && (
        <HouseholdModal
          household={editingHH||null}
          members={editingHH ? getPeopleForHousehold(people,editingHH.id) : []}
          adminConfig={adminConfig}
          onSave={saveHousehold}
          onClose={()=>{setShowAdd(false);setEditingHH(null);}}
          isArchived={isArchived}
        />
      )}
      {showImport && <ImportModal adminConfig={adminConfig} onImport={handleImport} onClose={()=>setShowImport(false)} />}
      {showGuestExport && (
        <GuestExportModal
          households={households} people={people} tables={tables} adminConfig={adminConfig}
          onPrint={(html)=>{setShowGuestExport(false);if(isTouchPrimary())printDocument(html);else setGuestPrintHTML(html);}}
          onClose={()=>setShowGuestExport(false)}
        />
      )}
      {guestPrintHTML && (
        <PrintPreviewModal html={guestPrintHTML} title="Print Preview — Guest List" onClose={() => setGuestPrintHTML(null)} />
      )}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Household"
          message="This will permanently delete this household and all its members."
          confirmLabel="Delete"
          onConfirm={() => deleteHousehold(deleteConfirm)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
      {mobileMoreFiltersOpen && sections.length > 1 && (
        <Modal onClose={()=>setMobileMoreFiltersOpen(false)} ariaLabel="Sub-Event Filters" unstyled
          style={{position:"fixed",left:0,right:0,bottom:0,background:"var(--bg-surface)",borderRadius:"var(--radius-lg) var(--radius-lg) 0 0",width:"100%",maxHeight:"75vh",overflowY:"auto",padding:"16px 18px 20px",boxShadow:"var(--shadow-lg)",animation:"slide-up 0.2s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>Sub-Event Filters</div>
            <button className="icon-btn" title="Close" aria-label="Close" onClick={()=>setMobileMoreFiltersOpen(false)}><Icon name="x" context="button" /></button>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Sub-Events</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {sections.map(s=>(
              <button key={s.id} className={`guest-chip ${subEventFilter.includes(s.id)?"guest-chip-active":""}`}
                onClick={()=>setSubEventFilter(f=>f.includes(s.id)?f.filter(x=>x!==s.id):[...f,s.id])}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Status</div>
          <select className="form-select" style={{width:"100%",padding:"10px 12px",fontSize:15,marginBottom:16}}
            value={subEventStatusFilter} onChange={e=>setSubEventStatusFilter(e.target.value)}
            disabled={subEventFilter.length===0}>
            <option value="All">Any status</option>
            {RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary" style={{flex:1}} onClick={()=>{setSubEventFilter([]);setSubEventStatusFilter("All");}}>Clear</button>
            <button className="btn btn-primary" style={{flex:1}} onClick={()=>setMobileMoreFiltersOpen(false)}>Apply</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const loadingStyle = { padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 };
