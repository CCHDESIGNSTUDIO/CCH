import { useState, useEffect, useRef } from "react";

// ============================================================
// CCH STUDIO — CLIENT PORTAL
// Production React Application
// Color: Black + Cyan + Gold
// ============================================================

// --- DATA LAYER ---
// Replace with API calls to SharePoint/your backend
const PROJECTS = [
  {
    id: "whitesail",
    name: "31 Whitesail",
    client: { first: "Sahand", last: "Nayebaziz", initials: "S" },
    phase: "Construction",
    period: "March 1–14, 2026",
    progress: [
      { id: "tile", title: "Ceramic Tile Installation", room: "Primary Bath", pct: 65, delivery: "Installing week of Mar 17", swatch: "limestone" },
      { id: "railing", title: "Forged Iron Railing", room: "Farmhouse Staircase", pct: 40, delivery: "Delivery Mar 28", swatch: "iron" },
      { id: "pendant", title: "Saddler Pendant Lighting", room: "Kitchen", pct: 30, delivery: "Delivery late March", swatch: "glass" },
    ],
    approvals: [
      { id: "a1", title: "Zellige Tile — Weathered White", room: "Primary Bath Floor", submitted: "Mar 5", daysWaiting: 9, swatch: "limestone", priority: "high" },
      { id: "a2", title: "Newel Post Detail — Option B", room: "Staircase · Forged Iron", submitted: "Mar 8", daysWaiting: 6, swatch: "iron", priority: "medium" },
    ],
    palette: [
      { name: "Limestone\nSurround", swatch: "limestone" },
      { name: "Forged\nIron", swatch: "iron" },
      { name: "Hand-Blown\nGlass", swatch: "glass" },
      { name: "White\nOak", swatch: "oak" },
    ],
    completed: [
      "Primhouse Bath Layout",
      "Staircase Framework",
      "Pendant Fixture Selection",
    ],
    timeline: [
      { date: "Mar 14", event: "Lighting plan submitted to electrician", type: "complete", icon: "⚡" },
      { date: "Mar 12", event: "Limestone confirmed for fireplace", type: "complete", icon: "🪨" },
      { date: "Mar 10", event: "Cabinet redlines fully approved", type: "complete", icon: "✓" },
      { date: "Mar 8", event: "Newel post options sent for approval", type: "pending", icon: "⏳" },
      { date: "Mar 5", event: "Bath tile selection sent for approval", type: "pending", icon: "⏳" },
      { date: "Mar 3", event: "Site visit — window measurements", type: "note", icon: "📐" },
    ],
    upcoming: [
      { week: "Week of Mar 17", items: ["Tile installation begins", "Grout color selection"] },
      { week: "Week of Mar 24", items: ["Railing delivery from Hubbardton Forge", "Site walkthrough scheduled"] },
    ],
    stats: { inProgress: 3, needApproval: 2, completed: 3, nextMilestone: "Mar 28" },
  },
  {
    id: "bradbury",
    name: "Bradbury-High",
    client: { first: "Josh", last: "Bradbury", initials: "J" },
    phase: "Design Development",
    period: "March 1–14, 2026",
    progress: [
      { id: "leather", title: "Leather Panel Headwall", room: "Primary Suite", pct: 55, delivery: "Optima samples arriving Mar 20", swatch: "iron" },
      { id: "upholstery", title: "Custom Sectional", room: "Great Room", pct: 25, delivery: "Universal Upholstery — fabric selection", swatch: "oak" },
    ],
    approvals: [
      { id: "b1", title: "Leather Finish — Cognac Pull-Up", room: "Primary Suite Headwall", submitted: "Mar 10", daysWaiting: 4, swatch: "iron", priority: "high" },
    ],
    palette: [
      { name: "Cognac\nLeather", swatch: "iron" },
      { name: "Brushed\nBrass", swatch: "glass" },
      { name: "White\nOak", swatch: "oak" },
      { name: "Charcoal\nLinen", swatch: "limestone" },
    ],
    completed: ["Floor plan revision 4 approved", "Lighting concept presentation"],
    timeline: [
      { date: "Mar 12", event: "Floor plan approved", type: "complete", icon: "✓" },
      { date: "Mar 10", event: "Leather samples sent for approval", type: "pending", icon: "⏳" },
      { date: "Mar 7", event: "Lighting concept presented", type: "complete", icon: "💡" },
    ],
    upcoming: [
      { week: "Week of Mar 17", items: ["Optima leather samples arrive", "Furniture layout review"] },
      { week: "Week of Mar 24", items: ["Millwork drawings due", "Color palette finalization"] },
    ],
    stats: { inProgress: 2, needApproval: 1, completed: 2, nextMilestone: "Mar 20" },
  },
  {
    id: "bugle",
    name: "Bugle Trail",
    client: { first: "April", last: "Box", initials: "A" },
    phase: "Procurement",
    period: "March 1–14, 2026",
    progress: [
      { id: "sourcing", title: "Four Hands Furniture Order", room: "Living & Dining", pct: 80, delivery: "Order confirmed — delivery Apr 5", swatch: "oak" },
      { id: "rugs", title: "Area Rug Selections", room: "Throughout", pct: 45, delivery: "3 options shortlisted", swatch: "glass" },
    ],
    approvals: [],
    palette: [
      { name: "Natural\nLinen", swatch: "oak" },
      { name: "Aged\nBrass", swatch: "glass" },
      { name: "Warm\nWalnut", swatch: "iron" },
      { name: "Ivory\nBouclé", swatch: "limestone" },
    ],
    completed: ["Four Hands order placed", "Dining table selection confirmed", "Window measurement completed"],
    timeline: [
      { date: "Mar 13", event: "Four Hands order confirmed", type: "complete", icon: "📦" },
      { date: "Mar 9", event: "Dining table approved", type: "complete", icon: "✓" },
      { date: "Mar 4", event: "Window measurements completed", type: "complete", icon: "📐" },
    ],
    upcoming: [
      { week: "Week of Mar 17", items: ["Rug samples arrive for review", "Accessory sourcing begins"] },
      { week: "Week of Mar 24", items: ["Four Hands delivery tracking update"] },
    ],
    stats: { inProgress: 2, needApproval: 0, completed: 3, nextMilestone: "Apr 5" },
  },
];

// --- DESIGN TOKENS ---
const T = {
  black: "#0D0D0D",
  dark: "#1A1A1A",
  card: "#222222",
  border: "#2E2E2E",
  cyan: "#00D4E8",
  cyanDim: "rgba(0,212,232,0.12)",
  cyanGlow: "rgba(0,212,232,0.25)",
  gold: "#C8B99A",
  goldDim: "rgba(200,185,154,0.12)",
  text: "#EAE6DD",
  muted: "#7A7468",
  green: "#3CB371",
  greenDim: "rgba(60,179,113,0.12)",
  amber: "#E8A832",
  amberDim: "rgba(232,168,50,0.12)",
  blueDim: "rgba(123,164,196,0.1)",
};

const SWATCHES = {
  limestone: { bg: "linear-gradient(135deg, #D4CBC0, #E0D8CC)", pattern: "stone" },
  iron: { bg: "linear-gradient(135deg, #3D3830, #5C534A)", pattern: "iron" },
  glass: { bg: "linear-gradient(135deg, #C8B99A, #B8A88A)", pattern: "glass" },
  oak: { bg: "linear-gradient(135deg, #E8E0D4, #F2EDE6)", pattern: "zellige" },
};

const FONT = {
  display: "'Cormorant Garamond', Georgia, serif",
  body: "'Montserrat', 'Helvetica Neue', sans-serif",
};

// --- COMPONENTS ---

function Swatch({ type, size = 80, border = true, children, style = {} }) {
  const sw = SWATCHES[type] || SWATCHES.limestone;
  return (
    <div style={{
      width: size, height: size, position: "relative", overflow: "hidden",
      background: sw.bg,
      border: border ? `1px solid ${T.cyan}` : "none",
      flexShrink: 0,
      ...style,
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "128px",
      }} />
      {children}
    </div>
  );
}

function ProgressRing({ pct, size = 72, stroke = 4, color = T.cyan, bgColor = T.border }) {
  const r = (size / 2) - (stroke * 2);
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bgColor} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT.body, fontSize: size * 0.25, fontWeight: 700, color,
      }}>{pct}%</div>
    </div>
  );
}

function Label({ children, color = T.text, style = {} }) {
  return (
    <div style={{
      fontFamily: FONT.body, fontSize: 11, letterSpacing: "0.2em",
      textTransform: "uppercase", fontWeight: 700, color, ...style,
    }}>{children}</div>
  );
}

function Badge({ children, color = T.amber }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 10px",
      background: color === T.amber ? "rgba(232,168,50,0.9)" : color,
      fontFamily: FONT.body, fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase",
    }}>{children}</span>
  );
}

function BtnCyan({ children, onClick, flex, style = {} }) {
  return (
    <button onClick={onClick} style={{
      flex: flex ? 1 : undefined, padding: "10px 24px", background: T.cyan, color: T.black,
      fontFamily: FONT.body, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      border: "none", cursor: "pointer", transition: "all 0.25s",
      ...style,
    }}>{children}</button>
  );
}

function BtnOutline({ children, onClick, flex, style = {} }) {
  return (
    <button onClick={onClick} style={{
      flex: flex ? 1 : undefined, padding: "10px 24px", background: "transparent",
      color: T.cyan, border: `1px solid ${T.cyan}`,
      fontFamily: FONT.body, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      cursor: "pointer", transition: "all 0.25s",
      ...style,
    }}>{children}</button>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: `linear-gradient(90deg, ${T.cyan}, ${T.gold})`,
        borderRadius: 2, transition: "width 0.6s ease",
      }} />
    </div>
  );
}

// --- MAIN APP ---

export default function CCHStudioPortal() {
  const [activeProject, setActiveProject] = useState(0);
  const [approvedItems, setApprovedItems] = useState({});
  const [hoveredCard, setHoveredCard] = useState(null);

  const project = PROJECTS[activeProject];

  function handleApprove(approvalId) {
    setApprovedItems(prev => ({ ...prev, [approvalId]: true }));
    // TODO: POST to SharePoint API to update approval status
  }

  const pendingApprovals = project.approvals.filter(a => !approvedItems[a.id]);

  return (
    <div style={{ minHeight: "100vh", background: T.black, color: T.text, fontFamily: FONT.display }}>

      {/* ===== NAV ===== */}
      <nav style={{
        background: T.dark, padding: "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontFamily: FONT.body, fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", color: T.cyan, fontWeight: 600 }}>CCH Studio</span>
          <div style={{ width: 1, height: 16, background: T.border }} />
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.muted }}>Client Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: `linear-gradient(135deg, ${T.cyan}, #0090A0)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: T.black, fontFamily: FONT.body, fontSize: 12, fontWeight: 700,
          }}>{project.client.initials}</div>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.muted }}>{project.client.first} {project.client.last.charAt(0)}.</span>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <div style={{
        position: "relative", height: 200, overflow: "hidden",
        background: `linear-gradient(135deg, ${T.black} 0%, #111 50%, ${T.dark} 100%)`,
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px",
        }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(13,13,13,0.9) 0%, rgba(13,13,13,0.4) 60%, rgba(13,13,13,0.2) 100%)" }} />
        <div style={{ position: "relative", zIndex: 2, padding: "0 40px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 28 }}>
          <Label color={T.cyan} style={{ fontSize: 10, marginBottom: 6 }}>{project.phase}</Label>
          <div style={{ fontSize: 42, color: T.gold, fontWeight: 300, fontStyle: "italic" }}>{project.name}</div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.muted, marginTop: 6 }}>Report period · {project.period}</div>
        </div>
        {/* Project tabs */}
        <div style={{ position: "absolute", right: 32, bottom: 20, display: "flex", gap: 6, zIndex: 2 }}>
          {PROJECTS.map((p, i) => (
            <button key={p.id} onClick={() => { setActiveProject(i); setApprovedItems({}); }}
              style={{
                padding: "8px 16px", fontFamily: FONT.body, fontSize: 11, cursor: "pointer",
                background: activeProject === i ? T.cyan : "rgba(0,0,0,0.5)",
                color: activeProject === i ? T.black : T.muted,
                border: `1px solid ${activeProject === i ? T.cyan : T.border}`,
                fontWeight: activeProject === i ? 700 : 400,
                backdropFilter: "blur(8px)", transition: "all 0.3s",
              }}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: -48, position: "relative", zIndex: 10, marginBottom: 36 }}>
          {[
            { val: project.stats.inProgress, label: "In Progress", color: T.cyan },
            { val: project.stats.needApproval, label: "Need Approval", color: T.amber },
            { val: project.stats.completed, label: "Completed", color: T.green },
            { val: project.stats.nextMilestone, label: "Next Milestone", color: T.gold },
          ].map((s, i) => (
            <div key={i} style={{
              padding: 20, textAlign: "center", background: T.card,
              border: `1px solid ${T.border}`, transition: "all 0.3s",
            }}>
              <div style={{ fontSize: typeof s.val === "number" ? 32 : 26, fontWeight: 300, color: s.color }}>{s.val}</div>
              <Label color={T.muted} style={{ fontSize: 9, marginTop: 6 }}>{s.label}</Label>
            </div>
          ))}
        </div>

        {/* Approvals */}
        {pendingApprovals.length > 0 && (
          <div style={{ padding: 28, background: T.card, border: `1px solid rgba(232,168,50,0.2)`, marginBottom: 32 }}>
            <Label color={T.amber} style={{ marginBottom: 20 }}>✦ Your Approvals Needed</Label>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {pendingApprovals.map(a => (
                <div key={a.id} style={{
                  flex: "1 1 220px", background: T.dark, border: `1px solid ${T.border}`,
                  overflow: "hidden", transition: "all 0.3s",
                }}>
                  <Swatch type={a.swatch} size="auto" border={false} style={{ width: "100%", height: 0, paddingTop: "56.25%", position: "relative" }}>
                    <div style={{ position: "absolute", top: 10, right: 10 }}><Badge>{a.daysWaiting}d waiting</Badge></div>
                  </Swatch>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontFamily: FONT.body, fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>{a.title}</div>
                    <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.muted, marginBottom: 14 }}>{a.room} · Submitted {a.submitted}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <BtnOutline flex>View</BtnOutline>
                      <BtnCyan flex onClick={() => handleApprove(a.id)}>Approve ✓</BtnCyan>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved confirmation */}
        {project.approvals.length > 0 && project.approvals.every(a => approvedItems[a.id]) && (
          <div style={{
            padding: 24, background: T.greenDim, border: `1px solid ${T.green}`,
            marginBottom: 32, textAlign: "center",
          }}>
            <div style={{ fontSize: 20, color: T.green, marginBottom: 4 }}>✓ All items approved</div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.muted }}>Thank you! Your design team has been notified.</div>
          </div>
        )}

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
          {/* Left column */}
          <div>
            <Label color={T.cyan} style={{ marginBottom: 16 }}>In Progress</Label>

            {project.progress.map((item, i) => (
              <div key={item.id}
                onMouseEnter={() => setHoveredCard(item.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  display: "flex", marginBottom: 12, background: T.card,
                  border: `1px solid ${hoveredCard === item.id ? `rgba(0,212,232,0.3)` : T.border}`,
                  overflow: "hidden", transition: "all 0.3s",
                  boxShadow: hoveredCard === item.id ? "0 4px 20px rgba(0,0,0,0.3)" : "none",
                }}>
                {/* Swatch with ring */}
                <div style={{
                  width: 130, minWidth: 130, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Swatch type={item.swatch} size="auto" border={false} style={{ position: "absolute", inset: 0 }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(13,13,13,0.3)" }} />
                  <div style={{ position: "relative" }}>
                    <ProgressRing pct={item.pct} size={56} stroke={3} />
                  </div>
                </div>
                {/* Info */}
                <div style={{ padding: "18px 20px", flex: 1 }}>
                  <Label color={T.gold} style={{ fontSize: 9, letterSpacing: "0.12em", marginBottom: 4 }}>{item.room}</Label>
                  <div style={{ fontFamily: FONT.body, fontSize: 15, fontWeight: 600, marginBottom: 8, color: T.text }}>{item.title}</div>
                  <ProgressBar pct={item.pct} />
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.muted, marginTop: 10 }}>{item.delivery}</div>
                </div>
              </div>
            ))}

            {/* Material Palette */}
            <div style={{ marginTop: 24, padding: 24, background: T.card, border: `1px solid ${T.border}` }}>
              <Label color={T.gold} style={{ marginBottom: 16 }}>Your Material Palette</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {project.palette.map((p, i) => (
                  <div key={i}>
                    <Swatch type={p.swatch} size="auto" style={{ width: "100%", aspectRatio: "1/1" }} />
                    <div style={{ fontFamily: FONT.body, fontSize: 9, color: T.muted, textAlign: "center", lineHeight: 1.4, marginTop: 8, whiteSpace: "pre-line" }}>{p.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed */}
            <div style={{ marginTop: 24, padding: 24, background: T.card, border: `1px solid ${T.border}` }}>
              <Label color={T.green} style={{ marginBottom: 16 }}>✓ Recently Completed</Label>
              {project.completed.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: T.green, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 10, fontWeight: 700,
                  }}>✓</div>
                  <span style={{ fontSize: 15, color: T.text }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Timeline */}
          <div style={{ padding: 24, background: T.card, border: `1px solid ${T.border}`, position: "sticky", top: 70 }}>
            <Label color={T.cyan} style={{ marginBottom: 20 }}>Activity Timeline</Label>

            {project.timeline.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 18, position: "relative" }}>
                {i < project.timeline.length - 1 && (
                  <div style={{ position: "absolute", left: 13, top: 28, bottom: 0, width: 1, background: T.border }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: t.type === "complete" ? T.greenDim : t.type === "pending" ? T.amberDim : T.blueDim,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                }}>{t.icon}</div>
                <div>
                  <div style={{ fontFamily: FONT.body, fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 2 }}>{t.date}</div>
                  <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.text, lineHeight: 1.5 }}>{t.event}</div>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div style={{ marginTop: 12, paddingTop: 16, borderTop: `1px solid ${T.border}`, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[
                { color: T.green, label: "Done" },
                { color: T.amber, label: "Approval" },
                { color: "#7BA4C4", label: "Note" },
              ].map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT.body, fontSize: 10, color: T.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                  {l.label}
                </div>
              ))}
            </div>

            {/* Coming Up */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
              <Label color={T.gold} style={{ marginBottom: 14 }}>Coming Up</Label>
              {project.upcoming.map((w, i) => (
                <div key={i} style={{ marginBottom: i < project.upcoming.length - 1 ? 14 : 0 }}>
                  <div style={{ fontFamily: FONT.body, fontSize: 11, color: T.cyan, fontWeight: 600, marginBottom: 4 }}>{w.week}</div>
                  {w.items.map((item, j) => (
                    <div key={j} style={{ fontFamily: FONT.body, fontSize: 11, color: T.muted, lineHeight: 1.6, paddingLeft: 8 }}>— {item}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 48, padding: "20px 32px",
        borderTop: `1px solid ${T.border}`, textAlign: "center",
        fontFamily: FONT.body, fontSize: 11, color: T.muted,
      }}>
        CCH Design Inc. · Client Portal · Questions? Contact Cynthia directly.
      </div>
    </div>
  );
}
