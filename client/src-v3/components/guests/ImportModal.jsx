// Moved verbatim from GuestsTab.jsx (V4.45.0 module split).
// V5.7.0: the preview is now a review step. Counts of ready vs needs-a-look, problems
// (no email, no address, possible duplicate) fixable inline, Change columns, and
// nothing is saved until "Import N households".
import { Fragment, useState, useMemo } from "react";
import { parseCSV, generateCSVTemplate, importCSVToGuestData, detectColumnMapping } from "@/utils/guests.js";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";

export function ImportModal({ adminConfig, existingHouseholds = [], onImport, onClose }) {
  const [stage,          setStage]          = useState("upload");
  const [rows,           setRows]           = useState([]);
  const [headers,        setHeaders]        = useState([]);
  const [mapping,        setMapping]        = useState({});
  const [confidence,     setConfidence]     = useState({});
  const [isPeopleCentric, setIsPeopleCentric] = useState(false);
  const [preview,        setPreview]        = useState(null);
  const [mergeMode,      setMergeMode]      = useState("append");
  const [error,          setError]          = useState("");
  const [fileName,       setFileName]       = useState("");
  const [rowCount,       setRowCount]       = useState(0);
  const [edits,          setEdits]          = useState({});   // householdId -> fixed fields
  const [decisions,      setDecisions]      = useState({});   // householdId -> "merge" | "keep"

  const FIELD_LABELS = {
    FormalName:"Household / Formal Name ★",Name2:"Name 2 (additional members)",
    Address1:"Street Address",Address2:"Address Line 2",City:"City",
    StateProvince:"State / Province",PostalCode:"Postal / ZIP Code",Country:"Country",
    Phone:"Phone",Email:"Email",Group:"Group",Status:"RSVP Status",
    EventSection:"Event Section",SaveTheDateSent:"Save the Date Sent",InviteSent:"Invite Sent",
    AccommodationNeeded:"Accommodation Needed",HouseholdNotes:"Household Notes",
    PersonFirstName:"Person First Name",PersonLastName:"Person Last Name",
    Title:"Title (Mr./Ms./etc.)",IsChild:"Is Child",IsAttending:"Is Attending",
    ShirtSize:"Shirt Size",PantSize:"Pant Size",MealChoice:"Meal Choice",
    Kosher:"Kosher",Dietary:"Dietary Notes",PersonNotes:"Person Notes",
  };

  // ── Review analysis (V5.7.0) ───────────────────────────────────────────────
  const review = useMemo(() => {
    if (!preview) return null;
    const norm = v => (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const append = mergeMode === "append";
    const byName = new Map(), byEmail = new Map();
    if (append) existingHouseholds.forEach(h => {
      if (norm(h.formalName)) byName.set(norm(h.formalName), h);
      if (h.email) byEmail.set(h.email.trim().toLowerCase(), h);
    });
    const eff = h => ({ ...h, ...(edits[h.id] || {}) });
    // A column nobody filled in is one note, not a flag on every row.
    const anyEmail   = preview.households.some(h => eff(h).email);
    const anyAddress = preview.households.some(h => eff(h).address1);
    const rowsOut = preview.households.map(h => {
      const e = eff(h);
      const dup = append ? (byEmail.get((e.email || "").trim().toLowerCase()) || byName.get(norm(e.formalName)) || null) : null;
      const decision = decisions[h.id];
      const problems = [];
      if (anyEmail && !e.email)           problems.push("no-email");
      if (anyAddress && !e.address1)      problems.push("no-address");
      if (dup && !decision)               problems.push("duplicate");
      return { hh: e, dup, decision, problems, members: preview.people.filter(p => p.householdId === h.id) };
    });
    const merged = rowsOut.filter(r => r.decision === "merge");
    const ready  = rowsOut.filter(r => r.problems.length === 0 && r.decision !== "merge").length;
    const look   = rowsOut.filter(r => r.problems.length > 0).length;
    return { rows: rowsOut, ready, look, importCount: rowsOut.length - merged.length, anyEmail, anyAddress,
             sorted: [...rowsOut].sort((a, b) => (b.problems.length > 0) - (a.problems.length > 0)) };
  }, [preview, edits, decisions, mergeMode, existingHouseholds]);

  const setFix = (id, patch) => setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  // Build what gets saved: edited households, merged rows folded into the household they matched.
  const buildPayload = () => {
    const fillKeys = ["email","phone","address1","address2","city","stateProvince","postalCode","country","group","notes"];
    const merges = [], dropped = new Map();
    review.rows.filter(r => r.decision === "merge").forEach(r => {
      const fields = {};
      fillKeys.forEach(k => { if (!r.dup[k] && r.hh[k]) fields[k] = r.hh[k]; });
      merges.push({ existingId: r.dup.id, fields });
      dropped.set(r.hh.id, r.dup.id);
    });
    return {
      households: review.rows.filter(r => !dropped.has(r.hh.id)).map(r => r.hh),
      people: preview.people.map(p => dropped.has(p.householdId) ? { ...p, householdId: dropped.get(p.householdId) } : p),
      merges,
    };
  };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    setFileName(file.name); setEdits({}); setDecisions({});
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (parsed.length===0){setError("No data rows found.");return;}
        const hdrs = Object.keys(parsed[0]);
        const {mapping:autoMap,confidence:autoConf,allMapped,isPeopleCentric:peopleCentric} = detectColumnMapping(hdrs);
        setRows(parsed);setRowCount(parsed.length);setHeaders(hdrs);setMapping(autoMap);setConfidence(autoConf);setIsPeopleCentric(peopleCentric);setError("");
        if (allMapped) {
          const {households,people,errors} = importCSVToGuestData(parsed,autoMap,peopleCentric);
          if (households.length===0){setError("Could not parse any households.");return;}
          setPreview({households,people,errors,peopleCentric});setEdits({});setDecisions({});setStage("preview");
        } else { setStage("mapping"); }
      } catch(err){setError("Could not parse CSV: "+err.message);}
    };
    reader.readAsText(file);
  };

  const handleApplyMapping = () => {
    if (!mapping["FormalName"]&&!isPeopleCentric){setError("Please map the Household / Formal Name column.");return;}
    const {households,people,errors} = importCSVToGuestData(rows,mapping,isPeopleCentric);
    if (households.length===0){setError("Could not parse any households with the current mapping.");return;}
    setPreview({households,people,errors,peopleCentric:isPeopleCentric});setEdits({});setDecisions({});setError("");setStage("preview");
  };

  const handleDownloadTemplate = () => {
    const csv=generateCSVTemplate(adminConfig);
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="simchakit-guest-template.csv";a.click();URL.revokeObjectURL(url);
  };

  return (
    <Modal onClose={onClose} title="Import Guests" className="modal-lg">
        <div className="modal-body">
          {stage==="upload" && (<>
            <div className="alert alert-info" style={{marginBottom:16}}>Upload any CSV file — SimchaKit will detect your columns automatically. Or download the template for a pre-formatted starting point.</div>
            {error && <div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
            <div style={{marginBottom:16}}>
              <button className="btn btn-secondary" onClick={handleDownloadTemplate}>↓ Download CSV Template</button>
              <div className="form-hint" style={{marginTop:6}}>Fill out in Excel or Google Sheets, then upload below. Any CSV format is also accepted.</div>
            </div>
            <div className="divider" />
            <div className="divider" />
            <div className="form-group"><label className="form-label">Upload CSV File</label><input type="file" accept=".csv,.txt" onChange={handleFile} style={{fontSize:13,color:"var(--text-primary)"}} /></div>
            <div className="form-group">
              <label className="form-label">Import Mode</label>
              <select className="form-select" value={mergeMode} onChange={e=>setMergeMode(e.target.value)}>
                <option value="append">Append to existing list</option>
                <option value="replace">Replace existing list</option>
              </select>
              {mergeMode==="replace"&&<div className="form-hint" style={{color:"var(--red)"}}>Warning: this will delete all existing guest data.</div>}
            </div>
          </>)}
          {stage==="mapping" && (<>
            <div className="alert alert-info" style={{marginBottom:12}}>Review the column mapping below. <strong>Household / Formal Name</strong> is required.</div>
            {error&&<div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
            <div style={{maxHeight:360,overflowY:"auto",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",marginBottom:12}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:"var(--bg-subtle)",position:"sticky",top:0}}><th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",fontSize:11,textTransform:"uppercase"}}>Your Column</th><th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",fontSize:11,textTransform:"uppercase"}}>SimchaKit Field</th></tr></thead>
                <tbody>
                  {headers.map(h=>{
                    const mappedField=Object.entries(mapping).find(([,v])=>v===h)?.[0]||"";
                    return(<tr key={h} style={{borderBottom:"1px solid var(--border)"}}><td style={{padding:"8px 12px",fontWeight:500}}>{h}{mappedField&&confidence[mappedField]==="alias"&&<span style={{marginLeft:6,fontSize:10,color:"var(--gold)",fontWeight:700}}>auto-matched</span>}{mappedField&&confidence[mappedField]==="exact"&&<span style={{marginLeft:6,fontSize:10,color:"var(--green)",fontWeight:700}}><Icon name="check" context="badge" /></span>}</td><td style={{padding:"6px 12px"}}><select className="form-select" style={{fontSize:12}} value={mappedField} onChange={e=>{const nf=e.target.value;const u={...mapping};Object.keys(u).forEach(k=>{if(u[k]===h)delete u[k];});if(nf){Object.keys(u).forEach(k=>{if(k===nf)delete u[k];});u[nf]=h;}setMapping(u);}}><option value="">— Skip this column —</option>{Object.entries(FIELD_LABELS).map(([field,label])=>(<option key={field} value={field}>{label}</option>))}</select></td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </>)}
          {stage==="preview" && preview && review && (<>
            {preview.errors&&preview.errors.length>0&&(<div className="alert alert-error" style={{marginBottom:12}}><div style={{fontWeight:700,marginBottom:6}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {preview.errors.length} row{preview.errors.length!==1?"s":""} could not be imported</div><div style={{maxHeight:120,overflowY:"auto"}}>{preview.errors.map((err,i)=>(<div key={i} style={{fontSize:12,borderTop:i>0?"1px solid rgba(0,0,0,0.1)":"none",paddingTop:i>0?4:0,marginTop:i>0?4:0}}><strong>Row {err.rowIndex}:</strong> {err.message}{err.rawRow&&Object.values(err.rawRow).filter(Boolean).length>0&&<span style={{color:"var(--text-muted)",marginLeft:6}}>({Object.values(err.rawRow).filter(Boolean).slice(0,3).join(", ")}{Object.values(err.rawRow).filter(Boolean).length>3?"…":""})</span>}</div>))}</div><div style={{fontSize:12,marginTop:8,fontStyle:"italic"}}>The other rows can still be imported below.</div></div>)}
            <div className="import-review-head">
              <div><strong>{fileName||"Your file"}</strong> <span className="import-review-sub">· {rowCount} row{rowCount!==1?"s":""} → {preview.households.length} household{preview.households.length!==1?"s":""}, {preview.people.length} {preview.people.length===1?"person":"people"}</span></div>
              <div className="import-review-counts">
                <span className="review-pill review-ok"><Icon name="check" context="badge" /> {review.ready} ready</span>
                <span className="review-pill review-look"><Icon name="alertTriangle" context="badge" /> {review.look} need{review.look===1?"s":""} a look</span>
              </div>
            </div>
            <div className="import-review-map">
              {Object.entries(mapping).slice(0,4).map(([field,col])=>(<span key={field} className="review-chip">{col} → {(FIELD_LABELS[field]||field).replace(" ★","")}</span>))}
              <button type="button" className="review-chip review-chip-btn" onClick={()=>setStage("mapping")}>Change columns</button>
            </div>
            {preview.peopleCentric&&<div className="form-hint" style={{marginBottom:8}}>Person-by-person format detected. Households were grouped for you.</div>}
            {!review.anyEmail && <div className="alert alert-warning" style={{marginBottom:10}}><Icon name="alertTriangle" context="badge" style={{marginRight:4}} /> None of these rows has an email. Messaging guests needs one, so add emails later or use Change columns if a column was missed.</div>}
            {review.anyEmail && !review.anyAddress && <div className="form-hint" style={{marginBottom:8}}>No addresses found in this file. Add them later for mailings.</div>}
            <div className="import-review-table">
              <table>
                <thead><tr><th>Household</th><th>People</th><th>Address</th><th>Email</th><th>Status</th></tr></thead>
                <tbody>
                  {review.sorted.map(r=>{
                    const merged = r.decision==="merge";
                    return (<Fragment key={r.hh.id}>
                      <tr style={{opacity:merged?0.55:1}}>
                        <td style={{fontWeight:600}}>{r.hh.formalName}</td>
                        <td>{r.members.length}</td>
                        <td>{r.hh.address1 ? [r.hh.address1,r.hh.city].filter(Boolean).join(", ") : "—"}</td>
                        <td>{r.hh.email || "—"}</td>
                        <td>
                          {merged && <span className="review-pill review-ok"><Icon name="check" context="badge" /> Merging into {r.dup.formalName}</span>}
                          {!merged && r.problems.length===0 && <span className="review-pill review-ok"><Icon name="check" context="badge" /> Ready</span>}
                          {!merged && r.problems.includes("no-address") && <span className="review-pill review-look"><Icon name="alertTriangle" context="badge" /> No address</span>}
                          {!merged && r.problems.includes("no-email") && <span className="review-pill review-look"><Icon name="alertTriangle" context="badge" /> No email · needed for invitations</span>}
                          {!merged && r.problems.includes("duplicate") && <span className="review-pill review-look"><Icon name="alertTriangle" context="badge" /> Possible duplicate</span>}
                          {!merged && r.decision==="keep" && r.dup && <span className="review-pill review-ok"><Icon name="check" context="badge" /> Keeping both</span>}
                        </td>
                      </tr>
                      {(r.problems.length>0 || r.decision) && (
                        <tr className="import-review-fix"><td colSpan={5}>
                          {r.problems.includes("no-email") && <label className="import-fix-field">Email<input className="form-input" type="email" value={edits[r.hh.id]?.email||""} onChange={e=>setFix(r.hh.id,{email:e.target.value})} placeholder="name@example.com" /></label>}
                          {r.problems.includes("no-address") && (<>
                            <label className="import-fix-field import-fix-wide">Street<input className="form-input" value={edits[r.hh.id]?.address1||""} onChange={e=>setFix(r.hh.id,{address1:e.target.value})} /></label>
                            <label className="import-fix-field">City<input className="form-input" value={edits[r.hh.id]?.city||r.hh.city||""} onChange={e=>setFix(r.hh.id,{city:e.target.value})} /></label>
                            <label className="import-fix-field import-fix-narrow">State<input className="form-input" value={edits[r.hh.id]?.stateProvince||r.hh.stateProvince||""} onChange={e=>setFix(r.hh.id,{stateProvince:e.target.value})} /></label>
                            <label className="import-fix-field import-fix-narrow">ZIP<input className="form-input" value={edits[r.hh.id]?.postalCode||r.hh.postalCode||""} onChange={e=>setFix(r.hh.id,{postalCode:e.target.value})} /></label>
                          </>)}
                          {r.dup && (<div className="import-fix-dup">
                            <span>Looks like <strong>{r.dup.formalName}</strong>{r.dup.address1?` (${r.dup.address1})`:""}, already on your list.</span>
                            {r.decision!=="merge" && <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setDecisions(d=>({...d,[r.hh.id]:"merge"}))}>Merge</button>}
                            {r.decision!=="keep" && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setDecisions(d=>({...d,[r.hh.id]:"keep"}))}>Keep both</button>}
                            {r.decision && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setDecisions(d=>{const n={...d};delete n[r.hh.id];return n;})}>Undo</button>}
                          </div>)}
                        </td></tr>
                      )}
                    </Fragment>);
                  })}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:10,fontSize:12,color:"var(--text-muted)"}}>Mode: <strong>{mergeMode==="append"?"Append to existing list":"Replace existing list"}</strong>. Nothing is saved until you choose Import.</div>
          </>)}
          {stage==="done"&&<div className="alert alert-success">Import complete. Your guest list has been updated.</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>{stage==="done"?"Close":"Cancel"}</button>
            {stage==="mapping"&&<><button className="btn btn-secondary" onClick={()=>{setStage("upload");setError("");}}>Back</button><button className="btn btn-primary" onClick={handleApplyMapping}>Preview Import</button></>}
            {stage==="preview"&&<><button className="btn btn-secondary" onClick={()=>setStage(headers.length>0&&mapping["FormalName"]?"mapping":"upload")}>Back</button><button className="btn btn-primary" disabled={!review||review.importCount===0&&review.rows.length===0} onClick={()=>{onImport(buildPayload(),mergeMode);setStage("done");}}>Import {review?.importCount ?? 0} household{review?.importCount===1?"":"s"}</button></>}
          </div>
        </div>
    </Modal>
  );
}
