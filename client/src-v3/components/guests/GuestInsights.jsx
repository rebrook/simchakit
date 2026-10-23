// Moved verbatim from GuestsTab.jsx (V4.45.0 module split) — no behavior changes.
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LabelList } from "recharts";
import { Icon } from "@/utils/iconMap.jsx";

// ── GuestInsights (unchanged from V2) ─────────────────────────────────────────
export function GuestInsights({ households, people, groups, statusStyle }) {
  const [open, setOpen] = useState(true);
  const hasData = households.length > 0;

  const rsvpData = useMemo(()=>{
    const counts={};households.forEach(h=>{const s=h.rsvpStatus||"Invited";counts[s]=(counts[s]||0)+1;});
    return ["RSVP Yes","Invited","Pending","Maybe","RSVP No"].filter(s=>counts[s]>0).map(s=>({name:s,value:counts[s]}));
  },[households]);

  const breakdownData = useMemo(()=>{
    const adults=people.filter(p=>!p.isChild).length;const kids=people.filter(p=>p.isChild).length;
    return [{name:"Adults",value:adults},{name:"Kids",value:kids}].filter(d=>d.value>0);
  },[people]);

  const groupData = useMemo(()=>{
    const counts={};households.forEach(h=>{const g=h.group||"Other";counts[g]=(counts[g]||0)+1;});
    return groups.filter(g=>counts[g]>0).map(g=>({name:g,value:counts[g]})).sort((a,b)=>b.value-a.value);
  },[households,groups]);

  if (!hasData) return null;

  const RSVP_COLORS={"RSVP Yes":"var(--green)","Invited":"var(--blue)","Pending":"var(--orange)","Maybe":"var(--gold)","RSVP No":"var(--red)"};
  const GROUP_COLORS=["var(--accent-primary)","var(--blue)","var(--green)","var(--gold)","var(--orange)","var(--red)"];
  const BREAKDOWN_COLORS=["var(--accent-primary)","var(--blue)"];

  const RsvpTT=({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;const pct=households.length>0?Math.round((d.value/households.length)*100):0;return<div className="budget-chart-tooltip"><div className="budget-chart-tooltip-title">{d.name}</div><div className="budget-chart-tooltip-row"><span className="budget-chart-tooltip-dot" style={{background:RSVP_COLORS[d.name]||"var(--accent-primary)"}} /><span>{d.value} household{d.value!==1?"s":""}</span><span style={{fontWeight:700}}>{pct}%</span></div></div>;};
  const BreakdownTT=({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;const pct=people.length>0?Math.round((d.value/people.length)*100):0;return<div className="budget-chart-tooltip"><div className="budget-chart-tooltip-title">{d.name}</div><div className="budget-chart-tooltip-row"><span className="budget-chart-tooltip-dot" style={{background:d.name==="Adults"?BREAKDOWN_COLORS[0]:BREAKDOWN_COLORS[1]}} /><span>{d.value} {d.name.toLowerCase()}</span><span style={{fontWeight:700}}>{pct}%</span></div></div>;};
  const GroupTT=({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;const pct=households.length>0?Math.round((d.value/households.length)*100):0;return<div className="budget-chart-tooltip"><div className="budget-chart-tooltip-title">{d.name}</div><div className="budget-chart-tooltip-row"><span>{d.value} household{d.value!==1?"s":""}</span><span style={{fontWeight:700}}>{pct}%</span></div></div>;};
  const renderPieLabel=({cx,cy,midAngle,innerRadius,outerRadius,value})=>{if(value===0)return null;const RADIAN=Math.PI/180;const radius=innerRadius+(outerRadius-innerRadius)*0.5;const x=cx+radius*Math.cos(-midAngle*RADIAN);const y=cy+radius*Math.sin(-midAngle*RADIAN);return<text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{fontSize:12,fontWeight:700}}>{value}</text>;};
  const collapsedSummary=[`${households.length} household${households.length!==1?"s":""}`,`${people.length} guest${people.length!==1?"s":""}`,rsvpData.find(d=>d.name==="RSVP Yes")?`${rsvpData.find(d=>d.name==="RSVP Yes").value} confirmed`:null].filter(Boolean).join(" · ");

  return (
    <div className="card budget-insights" style={{marginBottom:20}}>
      <div className="budget-insights-header" onClick={()=>setOpen(o=>!o)}>
        <div>
          <div className="card-title" style={{marginBottom:0}}><Icon name="guests" context="inline" style={{ marginRight: 6 }} /> Guest Insights</div>
          {!open&&<div className="card-subtitle" style={{marginBottom:0,marginTop:4}}>{collapsedSummary} · click to expand</div>}
        </div>
        <button className="budget-insights-toggle" aria-label={open?"Collapse":"Expand"}>{open ? <Icon name="chevronUp" context="inline" /> : <Icon name="chevronDown" context="inline" />}</button>
      </div>
      {open && (
        <div className="budget-insights-body">
          <div className="guest-insights-top-row">
            <div className="budget-chart-section guest-insights-rsvp">
              <div className="budget-chart-title">RSVP Breakdown</div>
              <div className="budget-chart-subtitle">Households by response status</div>
              <ResponsiveContainer width="100%" height={Math.max(120,rsvpData.length*36)}>
                <BarChart data={rsvpData} layout="vertical" margin={{top:4,right:48,left:0,bottom:4}} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{fontSize:11,fill:"var(--text-muted)"}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{fontSize:12,fill:"var(--text-primary)"}} axisLine={false} tickLine={false} />
                  <Tooltip content={<RsvpTT />} cursor={{fill:"var(--bg-subtle)"}} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>{rsvpData.map(entry=><Cell key={entry.name} fill={RSVP_COLORS[entry.name]||"var(--accent-primary)"} fillOpacity={0.8} />)}<LabelList dataKey="value" position="right" style={{fontSize:12,fontWeight:700,fill:"var(--text-secondary)"}} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {breakdownData.length>0 && (
              <div className="budget-chart-section guest-insights-breakdown">
                <div className="budget-chart-title">Guest Breakdown</div>
                <div className="budget-chart-subtitle">{people.length} individual{people.length!==1?"s":""} total</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <PieChart width={180} height={180}><Pie data={breakdownData} cx={88} cy={88} innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value" labelLine={false} label={renderPieLabel}>{breakdownData.map((entry,i)=><Cell key={entry.name} fill={BREAKDOWN_COLORS[i%BREAKDOWN_COLORS.length]} fillOpacity={0.85} />)}</Pie><Tooltip content={<BreakdownTT />} /></PieChart>
                  <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:4}}>
                    {breakdownData.map((entry,i)=>(<div key={entry.name} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:"50%",flexShrink:0,display:"inline-block",background:BREAKDOWN_COLORS[i%BREAKDOWN_COLORS.length],opacity:0.85}} /><span style={{fontSize:12,color:"var(--text-secondary)"}}>{entry.name}</span></div>))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {groupData.length>1 && (
            <div className="budget-chart-section">
              <div className="budget-chart-title">Households by Group</div>
              <div className="budget-chart-subtitle">How your guest list is divided</div>
              <ResponsiveContainer width="100%" height={Math.max(100,groupData.length*36)}>
                <BarChart data={groupData} layout="vertical" margin={{top:4,right:48,left:0,bottom:4}} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{fontSize:11,fill:"var(--text-muted)"}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{fontSize:12,fill:"var(--text-primary)"}} axisLine={false} tickLine={false} />
                  <Tooltip content={<GroupTT />} cursor={{fill:"var(--bg-subtle)"}} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>{groupData.map((entry,i)=><Cell key={entry.name} fill={GROUP_COLORS[i%GROUP_COLORS.length]} fillOpacity={0.75} />)}<LabelList dataKey="value" position="right" style={{fontSize:12,fontWeight:700,fill:"var(--text-secondary)"}} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
