// Moved verbatim from GuestsTab.jsx (V4.45.0 module split) — no behavior changes.
import { useState } from "react";
import { parseCSV, generateCSVTemplate, importCSVToGuestData, detectColumnMapping } from "@/utils/guests.js";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";

export function ImportModal({ adminConfig, onImport, onClose }) {
  const [stage,          setStage]          = useState("upload");
  const [rows,           setRows]           = useState([]);
  const [headers,        setHeaders]        = useState([]);
  const [mapping,        setMapping]        = useState({});
  const [confidence,     setConfidence]     = useState({});
  const [isPeopleCentric, setIsPeopleCentric] = useState(false);
  const [preview,        setPreview]        = useState(null);
  const [mergeMode,      setMergeMode]      = useState("append");
  const [error,          setError]          = useState("");

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

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (parsed.length===0){setError("No data rows found.");return;}
        const hdrs = Object.keys(parsed[0]);
        const {mapping:autoMap,confidence:autoConf,allMapped,isPeopleCentric:peopleCentric} = detectColumnMapping(hdrs);
        setRows(parsed);setHeaders(hdrs);setMapping(autoMap);setConfidence(autoConf);setIsPeopleCentric(peopleCentric);setError("");
        if (allMapped) {
          const {households,people,errors} = importCSVToGuestData(parsed,autoMap,peopleCentric);
          if (households.length===0){setError("Could not parse any households.");return;}
          setPreview({households,people,errors,peopleCentric});setStage("preview");
        } else { setStage("mapping"); }
      } catch(err){setError("Could not parse CSV: "+err.message);}
    };
    reader.readAsText(file);
  };

  const handleApplyMapping = () => {
    if (!mapping["FormalName"]&&!isPeopleCentric){setError("Please map the Household / Formal Name column.");return;}
    const {households,people,errors} = importCSVToGuestData(rows,mapping,isPeopleCentric);
    if (households.length===0){setError("Could not parse any households with the current mapping.");return;}
    setPreview({households,people,errors,peopleCentric:isPeopleCentric});setError("");setStage("preview");
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
          {stage==="preview" && preview && (<>
            {preview.peopleCentric&&<div className="alert alert-info" style={{marginBottom:12}}><strong>Person-by-person format detected.</strong> Households have been automatically grouped.</div>}
            {preview.errors&&preview.errors.length>0&&(<div className="alert alert-error" style={{marginBottom:12}}><div style={{fontWeight:700,marginBottom:6}}><Icon name="alertTriangle" context="badge" style={{ marginRight: 3 }} /> {preview.errors.length} row{preview.errors.length!==1?"s":""} could not be imported</div><div style={{maxHeight:120,overflowY:"auto"}}>{preview.errors.map((err,i)=>(<div key={i} style={{fontSize:12,borderTop:i>0?"1px solid rgba(0,0,0,0.1)":"none",paddingTop:i>0?4:0,marginTop:i>0?4:0}}><strong>Row {err.rowIndex}:</strong> {err.message}{err.rawRow&&Object.values(err.rawRow).filter(Boolean).length>0&&<span style={{color:"var(--text-muted)",marginLeft:6}}>({Object.values(err.rawRow).filter(Boolean).slice(0,3).join(", ")}{Object.values(err.rawRow).filter(Boolean).length>3?"…":""})</span>}</div>))}</div><div style={{fontSize:12,marginTop:8,fontStyle:"italic"}}>The {preview.households.length} valid household{preview.households.length!==1?"s":""} below will still be imported.</div></div>)}
            <div className="alert alert-success" style={{marginBottom:12}}>Ready to import {preview.households.length} household{preview.households.length!==1?"s":""} and {preview.people.length} individual{preview.people.length!==1?"s":""}.</div>
            <div style={{maxHeight:280,overflowY:"auto",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:"var(--bg-subtle)",position:"sticky",top:0}}>{["Household","Members","Group","Status"].map(h=>(<th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",fontSize:11,textTransform:"uppercase"}}>{h}</th>))}</tr></thead><tbody>{preview.households.map(hh=>{const members=preview.people.filter(p=>p.householdId===hh.id);return(<tr key={hh.id} style={{borderBottom:"1px solid var(--border)"}}><td style={{padding:"8px 12px",fontWeight:600}}>{hh.formalName}</td><td style={{padding:"8px 12px",color:"var(--text-secondary)"}}>{members.length>0?members.map(p=>[p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"?").join(", "):<span style={{color:"var(--text-muted)",fontStyle:"italic"}}>None</span>}</td><td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{hh.group}</td><td style={{padding:"8px 12px",color:"var(--text-muted)"}}>{hh.rsvpStatus}</td></tr>);})}</tbody></table></div>
            <div style={{marginTop:10,fontSize:12,color:"var(--text-muted)"}}>Mode: <strong>{mergeMode==="append"?"Append to existing list":"Replace existing list"}</strong></div>
          </>)}
          {stage==="done"&&<div className="alert alert-success">Import complete. Your guest list has been updated.</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>{stage==="done"?"Close":"Cancel"}</button>
            {stage==="mapping"&&<><button className="btn btn-secondary" onClick={()=>{setStage("upload");setError("");}}>Back</button><button className="btn btn-primary" onClick={handleApplyMapping}>Preview Import</button></>}
            {stage==="preview"&&<><button className="btn btn-secondary" onClick={()=>setStage(headers.length>0&&mapping["FormalName"]?"mapping":"upload")}>Back</button><button className="btn btn-primary" onClick={()=>{onImport(preview,mergeMode);setStage("done");}}>Confirm Import{preview?.errors?.length>0?` (${preview.households.length} rows)`:""}</button></>}
          </div>
        </div>
    </Modal>
  );
}
