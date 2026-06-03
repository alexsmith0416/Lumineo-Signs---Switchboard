import type {
  AppTile,
  Announcement,
  Birthday,
  InstallationWidgets,
  Kpi,
  OpsWidgets,
  Photo,
  ProductionWidgets,
  Resource,
  Role,
  SafetyMetric,
  SalesWidgets,
  ScheduledJob,
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
  currentStreakDays: 78,
  longestStreakDays: 390,
  lastResetDate: "2026-03-04",
};

// Source: Lumineo_KPI_Dashboard_Monthly_2026 — April-LT (and prior months for
// trend %). Sparkline order: Jan, Feb, Mar, Apr. Delta = April vs March.
// "Shown Views" column drives which roles receive each KPI:
//   - "All Views"          → every role
//   - "Operations, Sales"  → Operations + Sales
//   - "Operations"         → Operations only

const kpi_revApril: Kpi = {
  key: "rev_completions_april",
  label: "Completions Invoiced — April",
  value: 890833,
  valueFormat: "currency",
  delta: 21,
  deltaDirection: "down",
  deltaIsGood: false,
  sparkline: [779, 881, 1121, 891],
};

const kpi_revYtd: Kpi = {
  key: "rev_completions_ytd",
  label: "Completions Invoiced — YTD",
  value: 3665935,
  valueFormat: "currency",
  delta: 32,
  deltaDirection: "up",
  deltaIsGood: true,
  sparkline: [779, 1680, 2769, 3666],
};

const kpi_gmApril: Kpi = {
  key: "gm_pct_april",
  label: "GM % — April",
  value: 58.3,
  valueFormat: "percent",
  delta: 15,
  deltaDirection: "up",
  deltaIsGood: true,
  sparkline: [53.9, 43.1, 43.1, 58.3],
};

const kpi_gmYtd: Kpi = {
  key: "gm_pct_ytd",
  label: "GM % — YTD",
  value: 46.6,
  valueFormat: "percent",
  delta: 3,
  deltaDirection: "up",
  deltaIsGood: true,
  sparkline: [53.9, 43.5, 43.5, 46.6],
};

const kpi_dip: Kpi = {
  key: "dip_avg_days",
  label: "Avg Days Job Open (DIP)",
  value: 66,
  valueFormat: "int",
  delta: 10,
  deltaDirection: "up",
  deltaIsGood: false,
  sparkline: [54, 59, 60, 66],
};

const kpi_openJobs: Kpi = {
  key: "value_open_jobs",
  label: "Value of Open Jobs",
  value: 3098338,
  valueFormat: "currency",
  delta: 11,
  deltaDirection: "up",
  deltaIsGood: false,
  sparkline: [3348, 2666, 2788, 3098],
};

const kpi_newOrdApril: Kpi = {
  key: "new_orders_april",
  label: "New Orders — April",
  value: 1360447,
  valueFormat: "currency",
  delta: 31,
  deltaDirection: "down",
  deltaIsGood: false,
  sparkline: [744, 989, 1980, 1360],
};

const kpi_newOrdYtd: Kpi = {
  key: "new_orders_ytd",
  label: "New Orders — YTD",
  value: 5072801,
  valueFormat: "currency",
  delta: 37,
  deltaDirection: "up",
  deltaIsGood: true,
  sparkline: [744, 1732, 3712, 5073],
};

const kpi_empSat: Kpi = {
  key: "emp_sat_score",
  label: "Employee Satisfaction",
  value: 3.9,
  valueFormat: "text",
  textValue: "3.9 / 5",
  deltaDirection: "flat",
  delta: 0,
  sparkline: [4.1, 3.9, 3.9, 3.9],
};

const kpis_allViews: Kpi[]      = [kpi_gmApril, kpi_gmYtd, kpi_dip];
const kpis_opsAndSales: Kpi[]   = [kpi_revApril, kpi_revYtd, kpi_openJobs, kpi_newOrdApril, kpi_newOrdYtd];

export const kpisByRole: Record<Role, Kpi[]> = {
  Operations:   [...kpis_allViews, ...kpis_opsAndSales, kpi_empSat],
  Sales:        [...kpis_allViews, ...kpis_opsAndSales],
  Production:   [...kpis_allViews],
  Installation: [...kpis_allViews],
  Shipping:     [...kpis_allViews],
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
    targetUrl: "https://apps.powerapps.com/play/e/484cdd3c-4409-e741-bbd5-7c210e00310e/app/4ed31b48-ef55-4425-a993-5bbe3dc439e2",
  },
  {
    key: "weeklyScheduler",
    label: "Weekly Scheduler",
    emoji: "🗓️",
    audience: ["Operations", "Sales", "Production", "Installation", "Shipping"],
    badgeText: "23 this week",
    enabled: true,
    targetUrl: "prototypes/Weekly Scheduler Prototype.html",
  },
  {
    key: "signBuilderPro",
    label: "Sign Builder Pro",
    emoji: "✏️",
    audience: ["Operations", "Sales", "Production"],
    badgeText: "8 specs",
    enabled: true,
    targetUrl: "https://sign-builder-pro.vercel.app/",
  },
  {
    key: "timePhoto",
    label: "Time & Photo",
    emoji: "📷",
    audience: ["Operations", "Production", "Installation", "Shipping"],
    badgeText: "Punch in",
    enabled: true,
    targetUrl: "prototypes/time-and-photo.html",
  },
  {
    key: "estimating",
    label: "Estimating",
    emoji: "🧮",
    audience: ["Operations", "Sales"],
    badgeText: "6 in review",
    enabled: true,
    targetUrl: "https://apps.powerapps.com/play/e/484cdd3c-4409-e741-bbd5-7c210e00310e/app/c0284c40-d998-4e72-aeca-a25e29746c02",
  },
  {
    key: "salesHub",
    label: "Sales Hub",
    emoji: "💰",
    audience: ["Operations", "Sales"],
    badgeText: "11 opps",
    enabled: true,
    targetUrl: "prototypes/sales-hub-mockup.html",
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

/* ============ Per-resource personal schedule ============ */

export const resourcesByRole: Record<Role, Resource> = {
  Operations: {
    id: "res-ops-01",
    name: "Alex Smith",
    email: "alex@lumineosigns.com",
    initials: "AS",
    role: "Operations",
    department: "Operations",
    trade: "Operations Manager",
    resourceNumber: "R-014",
  },
  Sales: {
    id: "res-sal-03",
    name: "Jamie Rivera",
    email: "jamie@lumineosigns.com",
    initials: "JR",
    role: "Sales",
    department: "Sales",
    trade: "Account Executive",
    resourceNumber: "R-031",
  },
  Production: {
    id: "res-prd-07",
    name: "Chris Owen",
    email: "chris@lumineosigns.com",
    initials: "CO",
    role: "Production",
    department: "Production · Team U",
    trade: "Metal Fabricator",
    resourceNumber: "R-072",
  },
  Installation: {
    id: "res-ins-05",
    name: "Aiden Park",
    email: "aiden@lumineosigns.com",
    initials: "AP",
    role: "Installation",
    department: "Installation · Crew 2",
    trade: "Lead Installer",
    resourceNumber: "R-054",
  },
  Shipping: {
    id: "res-shp-02",
    name: "Priya Desai",
    email: "priya@lumineosigns.com",
    initials: "PD",
    role: "Shipping",
    department: "Shipping",
    trade: "Logistics Lead",
    resourceNumber: "R-021",
  },
};

export const myJobsByRole: Record<Role, ScheduledJob[]> = {
  Operations: [
    { id: "j-ops-1", jobNumber: "J123456", customer: "Hartford Medical Center", scope: "Backlit channel letters — review & approval",   priority: 1, weekBucket: "This week", startLabel: "Mon", dueLabel: "Fri",        estimatedHours: 6,  actualHours: 4,  status: "In progress" },
    { id: "j-ops-2", jobNumber: "J123512", customer: "Westfield Mall",           scope: "Monument fab schedule alignment",               priority: 2, weekBucket: "This week", startLabel: "Tue", dueLabel: "Thu",        estimatedHours: 4,  actualHours: 1,  status: "Not started" },
    { id: "j-ops-3", jobNumber: "J123478", customer: "Route 9 pylons",            scope: "Permit + crane scheduling",                     priority: 3, weekBucket: "Next week", startLabel: "Mon",   dueLabel: "Wed",        estimatedHours: 5,  actualHours: 0,  status: "Not started" },
  ],
  Sales: [
    { id: "j-sal-1", jobNumber: "Q-2026-118", customer: "Hartford Medical Center", scope: "Final quote walkthrough + close",              priority: 1, weekBucket: "This week", startLabel: "Tue", dueLabel: "Fri",        estimatedHours: 3,  actualHours: 2,  status: "In progress" },
    { id: "j-sal-2", jobNumber: "Q-2026-122", customer: "Westfield Mall",           scope: "Monument quote — revise & resend",             priority: 2, weekBucket: "This week", startLabel: "Wed", dueLabel: "Thu",        estimatedHours: 2,  actualHours: 0,  status: "Not started" },
    { id: "j-sal-3", jobNumber: "Q-2026-131", customer: "UConn facilities",          scope: "Wayfinding scope + site visit",                priority: 3, weekBucket: "Next week", startLabel: "Tue",   dueLabel: "Thu",        estimatedHours: 6,  actualHours: 0,  status: "Not started" },
  ],
  Production: [
    { id: "j-prd-1", jobNumber: "J123456", customer: "Hartford Medical Center", scope: "Cut & weld aluminum returns — channel letters", priority: 1, weekBucket: "This week", startLabel: "Mon", dueLabel: "Tue",        estimatedHours: 12, actualHours: 7,  status: "In progress", partnerLabel: "with Marcus L." },
    { id: "j-prd-2", jobNumber: "J123512", customer: "Westfield Mall",           scope: "Monument cabinet — frame fabrication",          priority: 2, weekBucket: "This week", startLabel: "Wed", dueLabel: "Thu",        estimatedHours: 14, actualHours: 0,  status: "Not started", partnerLabel: "with Hunter B." },
    { id: "j-prd-3", jobNumber: "J123488", customer: "Sunoco — Route 9",         scope: "LED retrofit kit — bracket weld",                priority: 3, weekBucket: "This week", startLabel: "Thu", dueLabel: "Fri",        estimatedHours: 4,  actualHours: 0,  status: "Not started" },
    { id: "j-prd-4", jobNumber: "J123524", customer: "UConn — wayfinding",       scope: "Cabinet runs — laser cut + form",                priority: 4, weekBucket: "Next week", startLabel: "Mon",   dueLabel: "Wed",        estimatedHours: 16, actualHours: 0,  status: "Not started" },
    { id: "j-prd-5", jobNumber: "J123478", customer: "Route 9 pylons",            scope: "Refurb — strip & re-skin",                       priority: 5, weekBucket: "Next week", startLabel: "Thu",   dueLabel: "Fri",        estimatedHours: 10, actualHours: 0,  status: "Not started" },
  ],
  Installation: [
    { id: "j-ins-1", jobNumber: "J123456", customer: "Hartford Medical Center", scope: "Channel letter install — face install + power",priority: 1, weekBucket: "This week", startLabel: "Wed", dueLabel: "Wed",        estimatedHours: 6,  actualHours: 0,  status: "Not started", partnerLabel: "Crew 2" },
    { id: "j-ins-2", jobNumber: "J123488", customer: "Sunoco — Route 9",         scope: "LED retrofit on canopy",                         priority: 2, weekBucket: "This week", startLabel: "Thu", dueLabel: "Thu",        estimatedHours: 5,  actualHours: 0,  status: "Not started", partnerLabel: "Crew 2" },
    { id: "j-ins-3", jobNumber: "J123501", customer: "Stop & Shop",              scope: "Cabinet sign install",                           priority: 3, weekBucket: "This week", startLabel: "Fri", dueLabel: "Fri",        estimatedHours: 4,  actualHours: 0,  status: "Not started", partnerLabel: "Crew 2" },
    { id: "j-ins-4", jobNumber: "J123512", customer: "Westfield Mall",           scope: "Monument set — crane + footings",               priority: 4, weekBucket: "Next week", startLabel: "Tue",   dueLabel: "Wed",        estimatedHours: 12, actualHours: 0,  status: "Not started", partnerLabel: "Crew 2 + crane" },
  ],
  Shipping: [
    { id: "j-shp-1", jobNumber: "J123456", customer: "Hartford Medical Center", scope: "Crate channel letter set — 1 crate, 240 lb",    priority: 1, weekBucket: "This week", startLabel: "Tue", dueLabel: "Tue",        estimatedHours: 2,  actualHours: 1,  status: "In progress" },
    { id: "j-shp-2", jobNumber: "J123512", customer: "Westfield Mall",           scope: "Crate monument cabinet — 2 crates, 580 lb",     priority: 2, weekBucket: "This week", startLabel: "Wed", dueLabel: "Wed",        estimatedHours: 3,  actualHours: 0,  status: "Not started" },
    { id: "j-shp-3", jobNumber: "J123488", customer: "Sunoco — Route 9",         scope: "Box LED retrofit kit — 4 boxes",                 priority: 3, weekBucket: "Next week", startLabel: "Mon",   dueLabel: "Mon",        estimatedHours: 2,  actualHours: 0,  status: "Not started" },
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

