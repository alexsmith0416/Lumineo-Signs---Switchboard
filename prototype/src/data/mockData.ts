import type {
  AppTile,
  Announcement,
  Birthday,
  Kpi,
  Photo,
  Role,
  SafetyMetric,
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
