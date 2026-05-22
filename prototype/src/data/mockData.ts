import type {
  AppTile,
  Announcement,
  Birthday,
  InstallationWidgets,
  Kpi,
  OpsWidgets,
  Photo,
  ProductionWidgets,
  Role,
  SafetyMetric,
  SalesWidgets,
  ShippingWidgets,
  User,
} from "../types";

export const usersByRole: Record<Role, User> = {
  Operations:   { name: "Alex Smith",      email: "alex@lumineosigns.com",   initials: "AS", role: "Operations" },
  Sales:        { name: "Jamie Rivera",    email: "jamie@lumineosigns.com",  initials: "JR", role: "Sales" },
  Production:   { name: "Marcus Lee",      email: "marcus@lumineosigns.com", initials: "ML", role: "Production" },
  Installation: { name: "Aiden Park",      email: "aiden@lumineosigns.com",  initials: "AP", role: "Installation" },
  Shipping:     { name: "Priya Desai",     email: "priya@lumineosigns.com",  initials: "PD", role: "Shipping" },
};

export const safetyMetric: SafetyMetric = {
  currentStreakDays: 247,
  longestStreakDays: 412,
  lastResetDate: "2025-04-03",
};

export const kpisByRole: Record<Role, Kpi[]> = {
  Operations: [
    { key: "revenue_this_week",  label: "Revenue This Week",  value: 84200,  valueFormat: "currency", delta: 12, deltaDirection: "up",   deltaIsGood: true,  sparkline: [62, 68, 71, 76, 73, 79, 84] },
    { key: "open_jobs",          label: "Open Jobs",          value: 17,     valueFormat: "int",      delta: 2,  deltaDirection: "up",   deltaIsGood: false, sparkline: [14, 15, 15, 16, 16, 17, 17] },
    { key: "jobs_at_risk",       label: "Jobs At Risk",       value: 3,      valueFormat: "int",      delta: 1,  deltaDirection: "up",   deltaIsGood: false, sparkline: [1, 2, 2, 2, 3, 3, 3] },
    { key: "hours_logged_today", label: "Hours Today",        value: 142,    valueFormat: "hours",    delta: 6,  deltaDirection: "down", deltaIsGood: false, sparkline: [148, 151, 145, 152, 149, 148, 142] },
  ],
  Sales: [
    { key: "my_open_opportunities", label: "My Opportunities", value: 11,     valueFormat: "int",      delta: 3,  deltaDirection: "up", deltaIsGood: true, sparkline: [6, 7, 8, 9, 9, 10, 11] },
    { key: "my_quota_pct",          label: "Quota Attained",   value: 68,     valueFormat: "percent",  delta: 7,  deltaDirection: "up", deltaIsGood: true, sparkline: [42, 48, 55, 58, 61, 64, 68] },
    { key: "won_this_month",        label: "Won This Month",   value: 47600,  valueFormat: "currency", delta: 22, deltaDirection: "up", deltaIsGood: true, sparkline: [12, 14, 22, 28, 31, 39, 47.6] },
  ],
  Production: [
    { key: "my_tasks_today",          label: "My Tasks Today",         value: 5,   valueFormat: "int",   deltaDirection: "flat", sparkline: [4, 5, 5, 4, 6, 5, 5] },
    { key: "my_hours_this_week",      label: "My Hours This Week",     value: 34, valueFormat: "hours", delta: 2,  deltaDirection: "up",   deltaIsGood: true,  sparkline: [28, 30, 32, 30, 33, 34, 34] },
    { key: "tasks_complete_this_week",label: "Completed This Week",    value: 19, valueFormat: "int",   delta: 4,  deltaDirection: "up",   deltaIsGood: true,  sparkline: [12, 14, 15, 16, 17, 18, 19] },
  ],
  Installation: [
    { key: "my_next_install",       label: "Next Install",         value: 0,    valueFormat: "text",    textValue: "Tomorrow, 8 AM — Hartford, CT", sparkline: [] },
    { key: "installs_this_week",    label: "Installs This Week",   value: 4,    valueFormat: "int",     delta: 1,  deltaDirection: "up",   deltaIsGood: true,  sparkline: [2, 3, 3, 4, 4, 4, 4] },
    { key: "est_vs_actual_hours",   label: "Est vs Actual",        value: 92,   valueFormat: "percent", delta: 3,  deltaDirection: "up",   deltaIsGood: true,  sparkline: [85, 87, 89, 90, 91, 91, 92] },
    { key: "tomorrow_weather",      label: "Tomorrow's Weather",   value: 0,    valueFormat: "text",    textValue: "☀️ 72° / 54°", sparkline: [] },
  ],
  Shipping: [
    { key: "packages_out_today",      label: "Packages Out Today",  value: 12,   valueFormat: "int",      delta: 2,  deltaDirection: "up",   deltaIsGood: true,  sparkline: [8, 9, 10, 10, 11, 11, 12] },
    { key: "packages_in_queue",       label: "In Queue",            value: 23,   valueFormat: "int",      delta: 5,  deltaDirection: "down", deltaIsGood: true,  sparkline: [30, 29, 28, 26, 25, 24, 23] },
    { key: "late_shipments",          label: "Late Shipments",      value: 1,    valueFormat: "int",      deltaDirection: "flat", sparkline: [1, 0, 1, 1, 0, 1, 1] },
    { key: "value_shipped_this_week", label: "Value Shipped",       value: 58400,valueFormat: "currency", delta: 18, deltaDirection: "up",   deltaIsGood: true,  sparkline: [22, 28, 35, 41, 47, 52, 58.4] },
  ],
};

export const announcements: Announcement[] = [
  { id: "a1", body: "Quarterly safety meeting Friday 2 PM in the main bay.", audience: "All" },
  { id: "a2", body: "New routing machine training next Tuesday — sign up in Teams.", audience: "Production" },
  { id: "a3", body: "Q3 commission structure changes posted — review with your lead.", audience: "Sales" },
  { id: "a4", body: "PPE inspection day moved to next Monday.", audience: "Installation" },
];

export const birthdays: Birthday[] = [
  { name: "Mike T.",   whenLabel: "Tuesday",      initials: "MT" },
  { name: "Sarah W.",  whenLabel: "Thursday",     initials: "SW" },
  { name: "James L.",  whenLabel: "Next Monday",  initials: "JL" },
  { name: "Devon K.",  whenLabel: "Next Friday",  initials: "DK" },
  { name: "Lila R.",   whenLabel: "In 11 days",   initials: "LR" },
];

export const appTiles: AppTile[] = [
  {
    key: "projectScheduler",
    label: "Project Scheduler",
    emoji: "📊",
    audience: ["Operations"],
    badgeText: "17 open",
    enabled: true,
  },
  {
    key: "weeklyScheduler",
    label: "Weekly Scheduler",
    emoji: "🗓️",
    audience: ["Operations", "Sales", "Production", "Installation", "Shipping"],
    badgeText: "23 this week",
    enabled: true,
  },
  {
    key: "signBuilderPro",
    label: "Sign Builder Pro",
    emoji: "✏️",
    audience: ["Operations", "Sales", "Production"],
    badgeText: "8 specs",
    enabled: true,
  },
  {
    key: "timePhoto",
    label: "Time & Photo",
    emoji: "📷",
    audience: ["Operations", "Production", "Installation", "Shipping"],
    badgeText: "Punch in",
    enabled: true,
  },
  {
    key: "salesHub",
    label: "Sales Hub",
    emoji: "💰",
    audience: ["Operations", "Sales"],
    badgeText: "11 opps",
    enabled: true,
  },
];

export const photos: Photo[] = [
  { id: "p1", caption: "Channel letters — Hartford Med",   jobNumber: "J123456", by: "Aiden",  gradient: "linear-gradient(135deg, #141464 0%, #2a2a8a 100%)" },
  { id: "p2", caption: "Monument sign — Westfield",         jobNumber: "J123512", by: "Hunter", gradient: "linear-gradient(135deg, #E8151B 0%, #ff6b6f 100%)" },
  { id: "p3", caption: "Pylon refurb — Route 9",            jobNumber: "J123478", by: "Aiden",  gradient: "linear-gradient(135deg, #0F6E56 0%, #2db58a 100%)" },
  { id: "p4", caption: "Cabinet sign — Stop & Shop",        jobNumber: "J123501", by: "Marcus", gradient: "linear-gradient(135deg, #BB87FC 0%, #7F77DD 100%)" },
  { id: "p5", caption: "LED retrofit — Sunoco",             jobNumber: "J123488", by: "Hunter", gradient: "linear-gradient(135deg, #4EA7FC 0%, #141464 100%)" },
  { id: "p6", caption: "Wayfinding install — UConn",        jobNumber: "J123524", by: "Aiden",  gradient: "linear-gradient(135deg, #F2994A 0%, #E8151B 100%)" },
  { id: "p7", caption: "Window vinyl — Dunkin'",            jobNumber: "J123533", by: "Lila",   gradient: "linear-gradient(135deg, #2db58a 0%, #4EA7FC 100%)" },
  { id: "p8", caption: "Backlit channel — Hartford Med",    jobNumber: "J123456", by: "Marcus", gradient: "linear-gradient(135deg, #141464 0%, #E8151B 100%)" },
];

/* ============ Role-specific home-screen widgets ============ */

export const opsWidgets: OpsWidgets = {
  deptLoad: [
    { label: "Production",   value: 142, valueLabel: "142 h", color: "navy" },
    { label: "Installation", value: 96,  valueLabel: "96 h",  color: "red" },
    { label: "Shipping",     value: 48,  valueLabel: "48 h",  color: "green" },
  ],
  lateTasks: [
    { id: "t1", primary: "Pylon refurb — fabrication",   secondary: "J123478 · Marcus L.", meta: "2 days late", badge: { text: "Production", tone: "navy" } },
    { id: "t2", primary: "Channel letters — paint",       secondary: "J123456 · Hunter B.", meta: "1 day late",  badge: { text: "Production", tone: "navy" } },
    { id: "t3", primary: "Site survey — Westfield",       secondary: "J123512 · Aiden P.",  meta: "3 days late", badge: { text: "Install",    tone: "red"  } },
    { id: "t4", primary: "Crate & label — Sunoco LED",    secondary: "J123488 · Priya D.",  meta: "1 day late",  badge: { text: "Shipping",   tone: "green" } },
  ],
  pendingApprovals: [
    { id: "a1", primary: "Hartford Med — backlit channel spec",  secondary: "Sign Builder · $18,400",  meta: "waiting 2d", badge: { text: "Spec",  tone: "amber" } },
    { id: "a2", primary: "Westfield Mall — monument quote",       secondary: "Sales Hub · $84,000",     meta: "waiting 1d", badge: { text: "Quote", tone: "red"   } },
    { id: "a3", primary: "Route 9 pylon — refurb scope",          secondary: "Sign Builder · $12,200",  meta: "waiting 4h", badge: { text: "Spec",  tone: "amber" } },
  ],
};

export const salesWidgets: SalesWidgets = {
  pipeline: [
    { label: "Lead",      value: 22, valueLabel: "22 · $164k", color: "navy" },
    { label: "Qualified", value: 14, valueLabel: "14 · $118k", color: "navy" },
    { label: "Quoted",    value: 9,  valueLabel: "9 · $82k",   color: "amber" },
    { label: "Won (mo)",  value: 5,  valueLabel: "5 · $47.6k", color: "green" },
  ],
  hotOpps: [
    { id: "o1", primary: "Hartford Medical Center", secondary: "$18,400 · closes Fri", meta: "Quoted",    badge: { text: "🔥", tone: "red" } },
    { id: "o2", primary: "Westfield Mall",           secondary: "$84,000 · closes Tue", meta: "Quoted",    badge: { text: "🔥", tone: "red" } },
    { id: "o3", primary: "UConn — wayfinding",       secondary: "$32,000 · closes 11/3", meta: "Qualified", badge: { text: "🔥", tone: "red" } },
    { id: "o4", primary: "Stop & Shop — Hartford",   secondary: "$9,800 · closes 11/8", meta: "Quoted",    badge: { text: "🔥", tone: "red" } },
  ],
  recentCustomers: [
    { id: "c1", primary: "Hartford Medical Center", secondary: "Quote sent · 2 h ago", icon: "📞" },
    { id: "c2", primary: "Sunoco — corporate",       secondary: "Email reply · 5 h ago", icon: "✉️" },
    { id: "c3", primary: "Dunkin' franchise group",  secondary: "Site visit · Tue",      icon: "📍" },
    { id: "c4", primary: "Westfield Mall",           secondary: "Call · yesterday",      icon: "📞" },
    { id: "c5", primary: "UConn facilities",         secondary: "Note added · Mon",      icon: "📝" },
  ],
  topCustomers: [
    { id: "tc1", primary: "Stop & Shop",            secondary: "$148,200 · 14 jobs", meta: "90d" },
    { id: "tc2", primary: "Hartford Medical Center", secondary: "$92,400 · 6 jobs",  meta: "90d" },
    { id: "tc3", primary: "Sunoco — corporate",      secondary: "$78,600 · 22 jobs", meta: "90d" },
    { id: "tc4", primary: "Dunkin' franchise group", secondary: "$54,100 · 18 jobs", meta: "90d" },
  ],
};

export const productionWidgets: ProductionWidgets = {
  todaysTasks: [
    { id: "p1", primary: "Cut channel letters — Hartford Med", secondary: "J123456 · 8 a–12 p",  badge: { text: "In progress", tone: "amber" } },
    { id: "p2", primary: "Paint pylon faces — Route 9",         secondary: "J123478 · 1 p–4 p",   badge: { text: "Up next",     tone: "navy" } },
    { id: "p3", primary: "LED retrofit assembly — Sunoco",     secondary: "J123488 · 4 p–6 p",   badge: { text: "Up next",     tone: "navy" } },
    { id: "p4", primary: "Crate completed cabinet — S&S",       secondary: "J123501 · end of day", badge: { text: "Tomorrow",   tone: "gray" } },
  ],
  shopCalendar: [
    { id: "sc1", primary: "Monument fab — Westfield",        secondary: "Tue · Hunter B.", meta: "12 h",  icon: "🔨" },
    { id: "sc2", primary: "Channel letter run — Hartford",   secondary: "Wed · Marcus L.", meta: "8 h",   icon: "🔨" },
    { id: "sc3", primary: "Pylon refurb — Route 9",          secondary: "Thu · Marcus L.", meta: "16 h",  icon: "🔨" },
    { id: "sc4", primary: "Wayfinding cabinets — UConn",     secondary: "Fri · Hunter B.", meta: "10 h",  icon: "🔨" },
    { id: "sc5", primary: "Window vinyl — Dunkin'",          secondary: "Fri · Lila R.",   meta: "4 h",   icon: "🔨" },
  ],
  needHelp: [
    { id: "h1", primary: "Hartford Med — face material shorts",  secondary: "blocked · need acrylic 4×8 white", badge: { text: "Blocked", tone: "red" } },
    { id: "h2", primary: "Westfield monument — art file missing", secondary: "blocked · ping Jamie",            badge: { text: "Blocked", tone: "red" } },
  ],
};

export const installationWidgets: InstallationWidgets = {
  route: [
    { id: "r1", order: 1, customer: "Hartford Medical Center", address: "85 Seymour St",      cityState: "Hartford, CT",   windowLabel: "8:00 a – 11:00 a",  jobNumber: "J123456", crewLabel: "2M 1T",     status: "Next" },
    { id: "r2", order: 2, customer: "Sunoco — Route 9",         address: "1244 Boston Post Rd", cityState: "Old Saybrook, CT", windowLabel: "12:00 p – 2:30 p", jobNumber: "J123488", crewLabel: "2M 1T 1L", status: "Upcoming" },
    { id: "r3", order: 3, customer: "Stop & Shop",              address: "1989 Park St",       cityState: "Hartford, CT",   windowLabel: "3:00 p – 5:00 p",  jobNumber: "J123501", crewLabel: "2M 1T",     status: "Upcoming" },
  ],
  photoChecklist: [
    { id: "pc1", label: "Wide shot — before",          required: true,  taken: true  },
    { id: "pc2", label: "Wide shot — after",           required: true,  taken: false },
    { id: "pc3", label: "Close-up — anchor / mounting", required: true,  taken: false },
    { id: "pc4", label: "Power connection / disconnect",required: true,  taken: false },
    { id: "pc5", label: "Signature / customer present", required: false, taken: false },
  ],
  materialsPull: [
    { id: "mp1", primary: "Acrylic 4×8 white — qty 2",    secondary: "Hartford Med · J123456", badge: { text: "Need", tone: "red" } },
    { id: "mp2", primary: "LED module 12V 4500K — qty 24", secondary: "Sunoco · J123488",      badge: { text: "Need", tone: "red" } },
    { id: "mp3", primary: "Anchor bolts ½″×6 — qty 8",     secondary: "Stop & Shop · J123501", badge: { text: "Low",  tone: "amber" } },
    { id: "mp4", primary: "Vinyl 3M IJ180 white — 5 yd",   secondary: "Dunkin' · J123533",     badge: { text: "OK",   tone: "green" } },
  ],
};

export const shippingWidgets: ShippingWidgets = {
  readyToShip: [
    { id: "rs1", primary: "Channel letter set — Hartford Med", secondary: "J123456 · 1 crate · 240 lb", meta: "today",    badge: { text: "Ready", tone: "green" } },
    { id: "rs2", primary: "Monument cabinet — Westfield",       secondary: "J123512 · 2 crates · 580 lb", meta: "today",    badge: { text: "Ready", tone: "green" } },
    { id: "rs3", primary: "LED retrofit kit — Sunoco",          secondary: "J123488 · 4 boxes",          meta: "tomorrow", badge: { text: "Ready", tone: "green" } },
    { id: "rs4", primary: "Window vinyl — Dunkin'",             secondary: "J123533 · 1 tube",           meta: "tomorrow", badge: { text: "Ready", tone: "green" } },
  ],
  inTransit: [
    { id: "it1", primary: "Cabinet sign — Stop & Shop", secondary: "FedEx Freight · ETA Wed",  badge: { text: "FedEx", tone: "navy" } },
    { id: "it2", primary: "Pylon face — Route 9 spare", secondary: "Own truck · in route",     badge: { text: "Own",   tone: "amber" } },
    { id: "it3", primary: "Backlit module — UConn",      secondary: "UPS Ground · ETA Thu",     badge: { text: "UPS",   tone: "navy" } },
  ],
  receivingToday: [
    { id: "rc1", primary: "Acrylic 4×8 white — qty 12", secondary: "Plastix Inc · PO-2026-0089",  icon: "📦" },
    { id: "rc2", primary: "LED modules 12V — qty 200",  secondary: "GE Lighting · PO-2026-0091", icon: "📦" },
    { id: "rc3", primary: "Aluminum tube 2×2 — 40 ft",   secondary: "Metro Metals · PO-2026-0092", icon: "📦" },
  ],
};

