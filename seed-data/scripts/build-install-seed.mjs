// build-install-seed.mjs — generate a scheduling-app-native installation data
// module (Department/Employee/ScheduleLine) from the 6/8 side-load, joined to
// the 728 production records for invoice $ and customer names.
//
// Output: scheduling-app/src/data/seed-install-week.generated.ts
//   exports WK_/NEK_ DEPARTMENTS, CREWS, LINES, WORK_HOURS, OVERTIME —
//   the same symbol names mock-installation.ts exports, so installation-data.ts
//   can import from here instead. Dates are built relative to the current
//   week's Monday (like the curated mock) so the week always renders on load.
//
// Run:  node seed-data/scripts/build-install-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '_source');
const OUT = join(__dirname, '..', '..', 'scheduling-app', 'src', 'data', 'seed-install-week.generated.ts');

const week = JSON.parse(readFileSync(join(SRC, 'install-schedule-week.json'), 'utf8'));
const jobs = JSON.parse(readFileSync(join(SRC, 'production-jobs.json'), 'utf8')).jobs;
const jobByNumber = new Map(jobs.map((j) => [j.jobNumber, j]));

const DAY_OFFSET = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
const HOMEBASE_DEPT = {
  Hutchinson: 'loc-hutch', Wichita: 'loc-wichita', Salina: 'loc-salina', 'Dodge City': 'loc-dodge',
};
const WK_DEPARTMENTS = [
  { id: 'loc-hutch', name: 'Hutchinson', flowOrder: 1, color: '#BED7FF' },
  { id: 'loc-wichita', name: 'Wichita', flowOrder: 2, color: '#FAC775' },
  { id: 'loc-salina', name: 'Salina', flowOrder: 3, color: '#C8E6D4' },
  { id: 'loc-dodge', name: 'Dodge City', flowOrder: 4, color: '#F8D5B7' },
];
const NEK_DEPARTMENTS = [{ id: 'loc-nek', name: 'NEK Crews', flowOrder: 1, color: '#CECBF6' }];

const slug = (region, name) =>
  `${region.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const round2 = (n) => Math.round(n * 100) / 100;

function buildRegion(code, region) {
  const deptOf = code === 'NEK' ? () => 'loc-nek' : (hb) => HOMEBASE_DEPT[hb] || 'loc-hutch';
  const crews = region.crews.map((c) => ({
    id: slug(code, c.employee),
    name: c.crew ? `${c.employee} (${c.crew})` : c.employee,
    departmentId: deptOf(c.homeBase),
    productivityRate: 1, standardHoursPerDay: 8, maxOvertimePerDay: 2,
    worksWeekends: false, hourlyRate: 60,
  }));

  const claimed = new Set(); // `${date}|${jobNo}` — invoice assigned once per job/day
  const lines = [];
  for (const c of region.crews) {
    const empId = slug(code, c.employee);
    // group entries by date so we can split the working day across them
    const byDate = new Map();
    for (const e of c.entries) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    }
    for (const [date, entries] of byDate) {
      const off = DAY_OFFSET[entries[0].dayOfWeek] ?? 0;
      const per = round2(8 / entries.length);
      let startHour = 8;
      entries.forEach((e, i) => {
        const hours = i === entries.length - 1 ? round2(8 - per * (entries.length - 1)) : per;
        const nums = e.jobNumbers || [];
        const isPTO = (e.status || '').toUpperCase() === 'PTO';
        const jobNo = nums.length ? nums.join(' / ') : (e.status || 'Service');
        const customer = e.customer || e.status || 'Service';
        const desc = (e.placeholder ? '[TEMPLATE] ' : '') + (e.task || e.note || e.status || '');
        // invoice: sum matched production values, credited to the first crew
        // that claims this job on this day (paired crews get 0)
        let invoice = 0;
        for (const n of nums) {
          const key = `${date}|${n}`;
          const j = jobByNumber.get(n);
          if (j && typeof j.value === 'number' && !claimed.has(key)) {
            invoice += j.value;
            claimed.add(key);
          }
        }
        lines.push({
          id: `${empId}-${e.dayOfWeek}-${i}`,
          jobNo, customerName: customer, planningLineDescription: desc,
          off, startHour: round2(startHour), endHour: round2(startHour + Math.min(hours, 8)),
          estimatedHours: hours, overrideHours: null, employeeId: empId,
          departmentId: deptOf(c.homeBase), customerDueDate: null,
          isLocked: isPTO, jobSequence: 1,
          invoiceAmount: round2(invoice), crewPersons: 1, crewTrucks: nums.length ? 1 : 0,
          crewCranes: 0, crewLifts: 0, crewBuckets: 0, installZip: '', region: code,
          isCustom: isPTO || undefined, customColor: isPTO ? '#FAB0B0' : undefined,
        });
        startHour += Math.min(hours, 8);
      });
    }
  }
  return { departments: code === 'NEK' ? NEK_DEPARTMENTS : WK_DEPARTMENTS, crews, lines };
}

// ---- serialize to TS ---------------------------------------------------------
const j = (v) => JSON.stringify(v);
const line = (l) =>
  `  { id:${j(l.id)}, jobNo:${j(l.jobNo)}, customerName:${j(l.customerName)}, ` +
  `planningLineDescription:${j(l.planningLineDescription)}, ` +
  `startDateTime: at(${l.off},${l.startHour}), endDateTime: at(${l.off},${l.endHour}), ` +
  `estimatedHours:${l.estimatedHours}, overrideHours:null, employeeId:${j(l.employeeId)}, ` +
  `departmentId:${j(l.departmentId)}, customerDueDate:null, isLocked:${l.isLocked}, jobSequence:1, ` +
  `invoiceAmount:${l.invoiceAmount}, crewPersons:1, crewTrucks:${l.crewTrucks}, crewCranes:0, ` +
  `crewLifts:0, crewBuckets:0, installZip:"", region:${j(l.region)}` +
  (l.isCustom ? `, isCustom:true, customColor:${j(l.customColor)}` : '') +
  ` },`;

const wk = buildRegion('WK', week.regions.WK);
const nek = buildRegion('NEK', week.regions.NEK);

const out = `// AUTO-GENERATED by seed-data/scripts/build-install-seed.mjs — do not edit by hand.
// Source: seed-data/_source/install-schedule-week.json (week of ${week.weekStart}),
// joined to production-jobs.json for invoice $ and customer names.
// Re-run the generator to refresh. Mirrors the exports of mock-installation.ts.
import { addDays, addHours, startOfWeek } from "date-fns";
import type {
  Department, Employee, OvertimeOverride, ScheduleLine, WorkHoursOverride,
} from "../engine/types";

const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
const at = (dayOffset: number, hour: number): Date => addHours(addDays(monday, dayOffset), hour);

export const WK_DEPARTMENTS: Department[] = ${j(wk.departments)};

export const WK_CREWS: Employee[] = ${j(wk.crews)};

export const WK_LINES: ScheduleLine[] = [
${wk.lines.map(line).join('\n')}
];

export const WK_WORK_HOURS: WorkHoursOverride[] = [];
export const WK_OVERTIME: OvertimeOverride[] = [];

export const NEK_DEPARTMENTS: Department[] = ${j(nek.departments)};

export const NEK_CREWS: Employee[] = ${j(nek.crews)};

export const NEK_LINES: ScheduleLine[] = [
${nek.lines.map(line).join('\n')}
];

export const NEK_WORK_HOURS: WorkHoursOverride[] = [];
export const NEK_OVERTIME: OvertimeOverride[] = [];
`;

writeFileSync(OUT, out);
const matched = [...wk.lines, ...nek.lines].filter((l) => l.invoiceAmount > 0).length;
console.log(`WK crews: ${wk.crews.length}  lines: ${wk.lines.length}`);
console.log(`NEK crews: ${nek.crews.length}  lines: ${nek.lines.length}`);
console.log(`Lines with invoice $ from production join: ${matched}`);
console.log(`Wrote ${OUT}`);
