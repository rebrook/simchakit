// Moved verbatim from GuestsTab.jsx (V4.45.0 module split) — no behavior changes.
import { useState, useEffect } from "react";
import { RSVP_STATUSES, TITLES, DEFAULT_GROUPS, DEFAULT_MEALS, isKosherMealChoice } from "@/constants/guest-constants.js";
import { SHIRT_SIZES } from "@/constants/theme.js";
import { sortTimeline } from "@/utils/dates.js";
import { newHouseholdId, newPersonId, newContactId } from "@/utils/ids.js";
import { formatPhone, getAddressFields, COUNTRIES } from "@/utils/guests.js";
import { isInvited, getSubEventStatus, getPersonSectionStatus } from "@/utils/sections.js";
import { RsvpPill } from "@/components/shared/RsvpPill.jsx";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";
import { statusStyle } from "@/components/guests/statusStyle.js";
import { SentChip } from "@/components/guests/SentChip.jsx";
import { MESSAGE_KINDS } from "@/utils/messageTemplates.js";

export function HouseholdModal({ household, members, adminConfig, sentLookup, onSave, onClose, isArchived }) {
  const groups      = adminConfig?.groups        || DEFAULT_GROUPS;
  const sections    = sortTimeline(adminConfig?.timeline || []).map(e => ({ id: e.id, label: (e.icon ? e.icon + " " : "") + e.title, inviteAllByDefault: e.inviteAllByDefault !== false }));
  const mealChoices = adminConfig?.mealChoices   || DEFAULT_MEALS;
  const sizes       = ["", ...(adminConfig?.shirtSizes || SHIRT_SIZES.filter(s => s))];
  const isEdit      = !!household;
  // The Meal Choice value that the Kosher checkbox syncs to when checked.
  // Uses adminConfig.kosherMealLabel if set, else the first mealChoices
  // entry that matches the "kosher" substring rule (see isKosherMealChoice).
  const kosherMealValue = mealChoices.find(m => isKosherMealChoice(m, adminConfig)) || "";

  const [step,            setStep]            = useState(1);
  const [activeTab,       setActiveTab]       = useState("details");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [hh, setHH] = useState(household ? { ...household, group: household.group || groups[0] || "" } : {
    id: newHouseholdId(), formalName: "", name2: "",
    address1: "", address2: "", city: "", stateProvince: "", postalCode: "", country: "",
    phone: "", email: "", group: groups[0]||"", rsvpStatus: "Pending",
    saveTheDateSent: false, inviteSent: false, thankYouSent: false, accommodationNeeded: false,
    rsvpDate: "", invitedSections: [], subEventRsvp: {}, attendingAdults: null, attendingKids: null,
    outOfTown: false, notes: "", contactLog: [],
  });
  const [ppl, setPpl] = useState(
    members && members.length > 0 ? members : [{
      id: newPersonId(), householdId: hh.id, firstName: "", lastName: "", title: "",
      isChild: false, isAttending: null, sectionRsvp: {}, tableId: null,
      shirtSize: "", pantSize: "", mealChoice: "", kosher: false, dietary: "", notes: "",
    }]
  );
  const setHHF = (k,v) => setHH(h => ({...h,[k]:v}));
  const [openSectionRsvp, setOpenSectionRsvp] = useState(null);
  const setSubEventRsvpStatus = (sectionId, status) => {
    setHHF("subEventRsvp", { ...(hh.subEventRsvp||{}), [sectionId]: status });
    setOpenSectionRsvp(null);
  };

  useEffect(() => {
    if (household && household.cityStateZip && !household.city) {
      setHH(h => ({ ...h, city: household.cityStateZip, stateProvince: h.stateProvince||"", postalCode: h.postalCode||"" }));
    }
  }, []);

  const addHHContact = () => setHHF("contactLog", [{ id: newContactId(), date: new Date().toISOString().slice(0,10), type: "Call", notes: "" }, ...(hh.contactLog||[])]);
  const updateHHContact = (id,field,val) => setHHF("contactLog",(hh.contactLog||[]).map(c=>c.id===id?{...c,[field]:val}:c));
  const deleteHHContact = (id) => setHHF("contactLog",(hh.contactLog||[]).filter(c=>c.id!==id));

  const addPerson = () => setPpl(ps => [...ps, { id: newPersonId(), householdId: hh.id, firstName: "", lastName: "", title: "", isChild: false, isAttending: null, sectionRsvp: {}, tableId: null, shirtSize: "", pantSize: "", mealChoice: "", kosher: false, dietary: "", notes: "" }]);
  const removePerson = id => setPpl(ps => ps.filter(p => p.id !== id));
  const setPF = (id,k,v) => setPpl(ps => ps.map(p => p.id===id ? {...p,[k]:v} : p));

  const handleSave = () => {
    if (!hh.formalName.trim()) return;
    const invitedIds = sections.filter(s => isInvited(hh, s)).map(s => s.id);
    const linked = ppl
      .filter(p => (p.firstName||p.lastName||p.name||"").trim())
      .map(p => ({
        ...p,
        householdId: hh.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "",
        sectionRsvp: Object.fromEntries(
          Object.entries(p.sectionRsvp || {}).filter(([sid]) => invitedIds.includes(sid))
        ),
      }));
    onSave({ household: { ...hh, formalName: hh.formalName.trim(), name2: (hh.name2||"").trim() }, people: linked });
  };

  const checkboxRow = [
    { key:"accommodationNeeded",label:"Accommodation Needed"},
    { key:"outOfTown",          label:"Out of Town"         },
  ];

  const personFields = (p, idx) => (
    <div key={p.id} style={{background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:14,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>Person {idx+1}</div>
        {ppl.length>1 && (
          confirmRemoveId===p.id ? (
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:"var(--text-muted)"}}>Remove {p.firstName?p.firstName:"this person"}?</span>
              <button className="btn btn-danger btn-sm" onClick={()=>{removePerson(p.id);setConfirmRemoveId(null);}}>Yes, Remove</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setConfirmRemoveId(null)}>Cancel</button>
            </div>
          ) : <button className="btn btn-danger btn-sm" onClick={()=>setConfirmRemoveId(p.id)}>Remove</button>
        )}
      </div>
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}><label className="form-label">First Name *</label><input className="form-input" value={p.firstName||""} onChange={e=>setPF(p.id,"firstName",e.target.value)} placeholder="Homer" /></div>
        <div className="form-group" style={{marginBottom:10}}><label className="form-label">Last Name</label><input className="form-input" value={p.lastName||""} onChange={e=>setPF(p.id,"lastName",e.target.value)} placeholder="Simpson" /></div>
      </div>
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Title</label>
          <select className="form-select" value={p.title||""} onChange={e=>setPF(p.id,"title",e.target.value)}>{TITLES.map(t=><option key={t} value={t}>{t||"— No title —"}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Age</label>
          <select className="form-select" value={p.isChild?"child":"adult"} onChange={e=>setPF(p.id,"isChild",e.target.value==="child")}><option value="adult">Adult</option><option value="child">Child</option></select>
        </div>
      </div>
      {sections.length>0 && (() => {
        const availableSections = sections.filter(s => isInvited(hh, s));
        return availableSections.length > 0 ? (
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Attending Sub-Events</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:2}}>
            {availableSections.map(s=>{
              const status = getPersonSectionStatus(p, s);
              const NEXT = { TBD: "Yes", Yes: "No", No: "TBD" };
              const tone  = status === "Yes" ? "tag-green" : status === "No" ? "tag-red" : "tag-muted";
              const glyph = status === "Yes" ? "✓" : status === "No" ? "✕" : "?";
              return (
                <button key={s.id} type="button" className={`tag ${tone}`}
                  style={{display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer",background:"var(--bg-surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"3px 8px"}}
                  title="Click to cycle: TBD → Yes → No"
                  onClick={()=>{
                    const nextStatus = NEXT[status];
                    const updated = { ...(p.sectionRsvp||{}) };
                    if (nextStatus === "TBD") delete updated[s.id]; else updated[s.id] = nextStatus;
                    setPF(p.id,"sectionRsvp",updated);
                  }}>
                  <span>{glyph}</span>{s.label}
                </button>
              );
            })}
          </div>
          <div className="form-hint">Click a sub-event to cycle TBD → Yes → No. Only sub-events this household is invited to appear here.</div>
        </div>
        ) : null;
      })()}
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Shirt Size</label>
          <select className="form-select" value={p.shirtSize||""} onChange={e=>setPF(p.id,"shirtSize",e.target.value)}>{sizes.map(s=><option key={s} value={s}>{s||"— None —"}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Pant Size</label>
          <select className="form-select" value={p.pantSize||""} onChange={e=>setPF(p.id,"pantSize",e.target.value)}>{sizes.map(s=><option key={s} value={s}>{s||"— None —"}</option>)}</select>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">Meal Choice</label>
          <select className="form-select" value={p.mealChoice||""} onChange={e=>{
            const val = e.target.value;
            const wasKosher = isKosherMealChoice(p.mealChoice, adminConfig);
            const nowKosher = isKosherMealChoice(val, adminConfig);
            setPF(p.id,"mealChoice",val);
            if (nowKosher) setPF(p.id,"kosher",true);
            else if (wasKosher) setPF(p.id,"kosher",false);
          }}><option value="">(none)</option>{mealChoices.map(m=><option key={m} value={m}>{m}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:10}}>
          <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer"}}>
            <input type="checkbox" checked={!!p.kosher} onChange={e=>{
              const checked = e.target.checked;
              setPF(p.id,"kosher",checked);
              if (checked) {
                if (kosherMealValue) setPF(p.id,"mealChoice",kosherMealValue);
              } else if (isKosherMealChoice(p.mealChoice, adminConfig)) {
                setPF(p.id,"mealChoice","");
              }
            }} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />
            Kosher meal required
          </label>
        </div>
      </div>
      <div className="form-group" style={{marginBottom:6}}><label className="form-label">Dietary Notes</label><input className="form-input" value={p.dietary||""} onChange={e=>setPF(p.id,"dietary",e.target.value)} placeholder="Allergies, restrictions…" /></div>
    </div>
  );

  // ── Merged sub-event invite + RSVP table ──────────────────────────────────
  // One row per sub-event: checkbox always visible; status pill and attending
  // summary only render once that row is invited (checked, or invited by
  // default). Replaces the old separate "Invited To Sub-Events" checklist and
  // "Sub-Event RSVP" list, which could show contradictory information (a pill
  // claiming Invited while the checklist above it showed nothing checked).
  // Rendered once here, referenced from two spots below depending on isEdit --
  // not duplicated JSX.
  const subEventBlock = sections.length > 0 && (
    <div className="form-group">
      <label className="form-label">Sub-Events</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:2}}>
        {sections.map(s => {
          const invited = isInvited(hh, s);
          const isDefaultAll = s.inviteAllByDefault !== false;
          const status = getSubEventStatus(hh, ppl, s);
          const attendingNames = ppl
            .filter(p => getPersonSectionStatus(p, s) === "Yes")
            .map(p => [p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"Unnamed")
            .join(", ");
          return (
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:invited?"var(--bg-subtle)":"transparent",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"6px 10px"}}>
              <input type="checkbox" checked={invited} disabled={isDefaultAll || isArchived}
                title={isDefaultAll ? "Everyone is invited to this sub-event by default -- change this in Admin Mode's Timeline" : "Invite this household to this sub-event"}
                onChange={e=>{
                  if (isDefaultAll) return;
                  const cur = hh.invitedSections||[];
                  setHHF("invitedSections", e.target.checked ? [...cur, s.id] : cur.filter(x=>x!==s.id));
                }}
                style={{width:14,height:14,accentColor:"var(--accent-primary)",cursor:isDefaultAll?"default":"pointer",flexShrink:0}} />
              <span style={{fontSize:12,fontWeight:600,color:invited?"var(--text-primary)":"var(--text-muted)",minWidth:140}}>{s.label}</span>
              {isDefaultAll && <span style={{fontSize:10,color:"var(--text-muted)",fontStyle:"italic"}}>Invited by default</span>}
              {invited && (
                <>
                  <RsvpPill value={status} open={openSectionRsvp===s.id}
                    onOpen={e=>{e.stopPropagation();if(!isArchived)setOpenSectionRsvp(openSectionRsvp===s.id?null:s.id);}}
                    onSelect={st=>setSubEventRsvpStatus(s.id, st)}
                    statusStyle={statusStyle} disabled={isArchived} />
                  <span style={{fontSize:11,color:"var(--text-muted)"}}>
                    {attendingNames ? `Attending: ${attendingNames}` : "No one marked attending yet"}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="form-hint">Status defaults to this household's overall RSVP status, or RSVP Yes once someone's marked attending on the Members step. Click a pill to set it explicitly. "Invited by default" sub-events include every household automatically -- change that in Admin Mode's Timeline.</div>
    </div>
  );

  return (
    <Modal onClose={onClose} ariaLabel={isEdit ? "Edit Household" : "Add Household"} className="modal-lg" maxWidth={640}>
      <div className="modal-header">
        <div>
          <div className="modal-title">{isEdit?"Edit Household":"Add Household"}</div>
          {!isEdit && <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>Step {step} of 2 — {step===1?"Household Details":"Members"}</div>}
        </div>
        <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}><Icon name="x" context="button" /></button>
      </div>
        {isEdit && (
          <div className="hh-modal-tabs">
            {[{id:"details",label:"Details"},{id:"address",label:"Address"},{id:"members",label:"Members"},{id:"flags",label:"Flags & Notes"},{id:"contacts",label:"Contact Log"}].map(t=>(
              <button key={t.id} className={`hh-modal-tab ${activeTab===t.id?"active":""}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
        )}
        <div className="modal-body" style={{maxHeight:"calc(85vh - 120px)",overflowY:"auto"}}>

          {/* ADD step 1 or EDIT details tab */}
          {((!isEdit && step===1) || (isEdit && activeTab==="details")) && (<>
            <div className="form-group"><label className="form-label">Formal Invitation Name *</label><input className="form-input" value={hh.formalName} onChange={e=>setHHF("formalName",e.target.value)} placeholder="e.g., Mr. and Mrs. Homer Simpson" /><div className="form-hint">As it will appear on the invitation envelope</div></div>
            <div className="form-group"><label className="form-label">Name 2 (second line)</label><input className="form-input" value={hh.name2} onChange={e=>setHHF("name2",e.target.value)} placeholder="e.g., Miss Lisa Simpson and Mr. Bart Simpson" /></div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Group</label><select className="form-select" value={hh.group} onChange={e=>setHHF("group",e.target.value)}>{groups.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
              <div className="form-group"><label className="form-label">RSVP Status</label><select className="form-select" value={hh.rsvpStatus} onChange={e=>setHHF("rsvpStatus",e.target.value)}>{RSVP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-group">
              <label className="form-label">RSVP Date</label>
              <input className="form-input" type="date" value={hh.rsvpDate} onChange={e=>setHHF("rsvpDate",e.target.value)} />
              {hh.rsvpDate && <div style={{fontSize:11,color:"var(--text-muted)",marginTop:3}}>{new Date(hh.rsvpDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric"})}</div>}
            {hh.rsvpDate && new Date(hh.rsvpDate+"T00:00:00") > new Date(Date.now() + 30*24*60*60*1000) && (
              <div style={{fontSize:11,color:"var(--gold)",marginTop:3}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> Date is more than 30 days in the future</div>
            )}
            </div>
            {hh.rsvpStatus === "RSVP Yes" && (
            <div style={{background:"var(--green-light)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)",padding:"12px 14px",marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--green)",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:4}}>Attending Count Override</div>
              <div style={{fontSize:12,color:"var(--green)",marginBottom:10,lineHeight:1.5}}>
                Leave blank to use the count from individual members. Set these only when fewer people are attending than invited.
              </div>
              <div className="form-grid-2" style={{marginBottom:0}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Attending Adults</label>
                <input className="form-input" type="number" min="0"
                  value={hh.attendingAdults ?? ""}
                  onChange={e=>setHHF("attendingAdults", e.target.value==="" ? null : Math.max(0, parseInt(e.target.value)||0))}
                  placeholder="Default: computed from members" />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Attending Kids</label>
                <input className="form-input" type="number" min="0"
                  value={hh.attendingKids ?? ""}
                  onChange={e=>setHHF("attendingKids", e.target.value==="" ? null : Math.max(0, parseInt(e.target.value)||0))}
                  placeholder="Default: computed from members" />
              </div>
            </div>
            </div>
            )}
            {isEdit && subEventBlock}
          </>)}

          {/* Address tab (edit only) or in-line (add step 1) */}
          {((!isEdit && step===1) || (isEdit && activeTab==="address")) && (<>
            <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={hh.address1} onChange={e=>setHHF("address1",e.target.value)} placeholder="Street address" /></div>
            <div className="form-group"><label className="form-label">Address Line 2</label><input className="form-input" value={hh.address2||""} onChange={e=>setHHF("address2",e.target.value)} placeholder="Apt, Suite, Unit (optional)" /></div>
            <div className="form-group"><label className="form-label">Country</label><select className="form-select" value={hh.country||""} onChange={e=>setHHF("country",e.target.value)}><option value="">— Select country —</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label className="form-label">City</label><input className="form-input" value={hh.city||""} onChange={e=>setHHF("city",e.target.value)} placeholder="Springfield" /></div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{getAddressFields(hh.country).stateLabel}</label>
                {getAddressFields(hh.country).stateOptions
                  ? <select className="form-select" value={hh.stateProvince||""} onChange={e=>setHHF("stateProvince",e.target.value)}><option value="">— Select —</option>{getAddressFields(hh.country).stateOptions.map(s=><option key={s} value={s}>{s}</option>)}</select>
                  : <input className="form-input" value={hh.stateProvince||""} onChange={e=>setHHF("stateProvince",e.target.value)} placeholder="Region" />}
              </div>
              <div className="form-group"><label className="form-label">{getAddressFields(hh.country).postalLabel}</label><input className="form-input" value={hh.postalCode||""} onChange={e=>setHHF("postalCode",e.target.value)} placeholder={hh.country==="United States"?"62701":hh.country==="Canada"?"A1A 1A1":hh.country==="United Kingdom"?"EC1A 1BB":"Postal code"} /></div>
            </div>
            {(() => {
              const v = hh.postalCode || "";
              let invalid = false;
              if (hh.country === "United States")  invalid = !/^\d{5}(-\d{4})?$/.test(v) && v.length > 0;
              else if (hh.country === "Canada")        invalid = !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v) && v.length > 0;
              else if (hh.country === "United Kingdom") invalid = !/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(v) && v.length > 0;
              else if (hh.country === "Australia")      invalid = !/^\d{4}$/.test(v) && v.length > 0;
              return invalid ? <div style={{fontSize:11,color:"var(--gold)",marginTop:3}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> Format looks off for {hh.country}</div> : null;
            })()}
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={hh.phone} onChange={e=>setHHF("phone",e.target.value)} onBlur={e=>setHHF("phone",formatPhone(e.target.value))} placeholder="(555) 555-1234" /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={hh.email} onChange={e=>setHHF("email",e.target.value)} onBlur={e=>setHHF("email",e.target.value.toLowerCase().trim())} placeholder="email@example.com" /></div>
            </div>
          </>)}

          {/* Flags & Notes */}
          {((!isEdit && step===1) || (isEdit && activeTab==="flags")) && (
            <>
              <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:14}}>
                {checkboxRow.map(({key,label})=>(
                  <label key={key} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!hh[key]} onChange={e=>setHHF(key,e.target.checked)} style={{width:15,height:15,accentColor:"var(--accent-primary)"}} />{label}
                  </label>
                ))}
              </div>
              {isEdit && sentLookup && (
                <div className="msg-mail-panel">
                  <div className="msg-chip-group">
                    <span className="msg-chip-label">Mailings</span>
                    {MESSAGE_KINDS.filter(k => k.manual).map(k => (
                      <SentChip key={k.key} status={sentLookup(hh, k.key)} kindLabel={k.label} />
                    ))}
                  </div>
                  <div style={{fontSize:12,color:"var(--text-muted)"}}>
                    This comes from your message record, so it can't be edited here. Close this window and use Message guests or Mark as sent on the household to change it.
                  </div>
                </div>
              )}
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={hh.notes} rows={2} onChange={e=>setHHF("notes",e.target.value)} placeholder="Any notes about this household..." /></div>
              {!isEdit && subEventBlock}
            </>
          )}

          {/* Members tab (edit) or step 2 (add) */}
          {((!isEdit && step===2) || (isEdit && activeTab==="members")) && (<>
            <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,color:"var(--text-muted)"}}>Add each individual in this household.</div>
              <button className="btn btn-secondary btn-sm" onClick={addPerson}>+ Add Person</button>
            </div>
            {ppl.map((p, idx) => personFields(p, idx))}
          </>)}

          {/* Contact Log tab (edit only) */}
          {isEdit && activeTab==="contacts" && (
            <div className="form-group" style={{marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <label className="form-label" style={{marginBottom:0}}>Contact Log</label>
                <button type="button" className="btn btn-secondary btn-sm" disabled={isArchived} onClick={addHHContact}>+ Log Contact</button>
              </div>
              {(hh.contactLog||[]).length===0 ? (
                <div style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic",padding:"10px 12px",background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}>
                  No contacts logged yet — record calls, texts, emails, and RSVP follow-ups.
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[...(hh.contactLog||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(c=>(
                    <div key={c.id} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"10px 12px",background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}>
                      <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                        <div style={{display:"flex",gap:6}}>
                          <input className="form-input" type="date" value={c.date||""}
                            onChange={e=>updateHHContact(c.id,"date",e.target.value)}
                            style={{fontSize:13,flex:"0 0 150px"}} />
                          <select className="form-select" value={c.type||"Call"}
                            onChange={e=>updateHHContact(c.id,"type",e.target.value)}
                            style={{fontSize:13,flex:"0 0 130px"}}>
                            {["Call","Email","In Person","Text","Other"].map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <input className="form-input" value={c.notes||""}
                          onChange={e=>updateHHContact(c.id,"notes",e.target.value)}
                          placeholder="What was discussed or decided?"
                          style={{fontSize:13}} />
                      </div>
                      <button type="button" className="icon-btn" title="Remove contact" aria-label="Remove contact"
                        style={{color:"var(--red)",flexShrink:0,marginTop:2}}
                        disabled={isArchived}
                        onClick={()=>deleteHHContact(c.id)}><Icon name="trash2" context="button" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="modal-footer">
            <span style={{fontSize:11,color:"var(--text-muted)",marginRight:"auto"}}>* required</span>
            {!isEdit && step===1 && <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={()=>setStep(2)} disabled={!hh.formalName.trim()}>Next: Members →</button></>}
            {!isEdit && step===2 && <><button className="btn btn-secondary" onClick={()=>setStep(1)}>← Back</button><button className="btn btn-primary" onClick={handleSave} disabled={!hh.formalName.trim()}>Add Household</button></>}
            {isEdit && <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={!hh.formalName.trim()||isArchived}>Save Changes</button></>}
          </div>
        </div>
    </Modal>
  );
}
