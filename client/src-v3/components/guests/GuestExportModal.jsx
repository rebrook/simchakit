// Moved verbatim from GuestsTab.jsx (V4.45.0 module split) — no behavior changes.
import { useState } from "react";
import { exportToInvitationCSV, exportGuestsByHousehold, exportGuestsByPerson, generateGuestPrintHTML, exportEmailListCSV } from "@/utils/guests.js";
import { Modal } from "@/components/shared/Modal.jsx";
import { Icon } from "@/utils/iconMap.jsx";

export function GuestExportModal({ households, people, tables, adminConfig, sentLookup, onPrint, onClose }) {
  const [activeExport, setActiveExport] = useState(null);
  const [copied,       setCopied]       = useState(false);
  const csvContent = (() => {
    if (activeExport==="byHousehold") return exportGuestsByHousehold(households,people,adminConfig,sentLookup);
    if (activeExport==="byPerson")    return exportGuestsByPerson(households,people,adminConfig,tables);
    if (activeExport==="mailing")     return exportToInvitationCSV(households,people);
    if (activeExport==="emailList")   return exportEmailListCSV(households);
    return "";
  })();
  const handlePrint = () => {
    const mainEvt=(adminConfig?.timeline||[]).find(e=>e.isMainEvent);
    onPrint(generateGuestPrintHTML(households,people,adminConfig?.name||"",mainEvt?.startDate||"",adminConfig?.theme||{},adminConfig?.logoUrl||null));
  };
  const OPTION=(key)=>({flex:"1 1 180px",padding:"14px 16px",borderRadius:"var(--radius-md)",border:activeExport===key?"2px solid var(--accent-primary)":"2px solid var(--border)",background:activeExport===key?"var(--accent-light)":"var(--bg-surface)",cursor:"pointer",textAlign:"left",transition:"border-color 0.15s"});
  const PRINT_OPT=()=>({flex:"1 1 180px",padding:"14px 16px",borderRadius:"var(--radius-md)",border:"2px solid var(--border)",background:"var(--bg-surface)",cursor:"pointer",textAlign:"left"});
  const ALERT_TEXT={byHousehold:"One row per household, sorted by last name. Paste into Excel or Google Sheets.",byPerson:"One row per individual with meal choice, kosher flag, dietary notes, shirt size, and table. Best pasted into Excel — filter by Kosher, Meal, or Dietary to prep catering sheets.",mailing:"Address fields are split into separate columns (Street, City, State, Zip, Country) for mail-merge compatibility. Paste into Excel or share with anyone who needs a structured address list.",emailList:"One row per household with an email address on file. Includes formal name, group, RSVP status, email, and phone. Ready for mail merge, bulk email, or RSVP follow-up."};
  return (
    <Modal onClose={onClose} title="Export Guest List" className="modal-lg" maxWidth={640}>
        <div className="modal-body">
          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            <button style={OPTION("byHousehold")} onClick={()=>{setActiveExport("byHousehold");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}><Icon name="guests" context="button" /></div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>By Household</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>One row per household with RSVP status, headcount, address, and sub-events. Best for your planner or a full reference spreadsheet.</div></button>
            <button style={OPTION("byPerson")} onClick={()=>{setActiveExport("byPerson");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}><Icon name="people" context="button" /></div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>By Person</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>One row per individual with meal choice, kosher flag, dietary notes, shirt size, and table. Best for catering, favors vendor, or day-of staff.</div></button>
            <button style={OPTION("mailing")} onClick={()=>{setActiveExport("mailing");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}><Icon name="mail" context="button" /></div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Mailing / Invitations</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>Formal names and addresses with split columns (Street, City, State, Zip, Country). Ready for mail-merge, a calligrapher, or any vendor that needs a structured address list.</div></button>
            <button style={OPTION("emailList")} onClick={()=>{setActiveExport("emailList");setCopied(false);}}><div style={{fontSize:22,marginBottom:6}}><Icon name="mail" context="button" /></div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Email List</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>Email addresses and phone numbers for all households. Ready for mail merge, bulk email, or RSVP follow-up.</div></button>
            <button style={PRINT_OPT()} onClick={handlePrint}><div style={{fontSize:22,marginBottom:6}}><Icon name="printer" context="button" /></div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Printable View</div><div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>Grouped by family / friend group with members, RSVP status, headcount, and dietary flags. Print-ready for a day-of binder or door checklist.</div></button>
          </div>
          {activeExport && (<><div className="alert alert-info" style={{marginBottom:10}}>{ALERT_TEXT[activeExport]}</div><textarea readOnly value={csvContent} onClick={e=>e.target.select()} style={{width:"100%",minHeight:180,background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:10,fontFamily:"var(--font-mono,monospace)",fontSize:11,resize:"vertical"}} /><div className="modal-footer" style={{marginTop:12}}><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={()=>navigator.clipboard.writeText(csvContent).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})}>{copied?<><Icon name="check" context="badge" /> Copied!</>:"Copy to Clipboard"}</button></div></>)}
          {!activeExport && <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>}
        </div>
    </Modal>
  );
}
