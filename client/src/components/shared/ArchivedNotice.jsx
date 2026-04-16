export function ArchivedNotice() {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      background:"var(--gold-light)", border:"1px solid var(--gold-medium)",
      borderRadius:"var(--radius-md)", padding:"10px 16px",
      fontSize:13, fontWeight:600, color:"var(--gold)", marginBottom:20,
    }}>
      <span style={{fontSize:16}}>🔒</span>
      <span>This event is archived and read-only. Open Admin Mode and unarchive to make changes.</span>
    </div>
  );
}
