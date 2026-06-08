// install-job-values.mjs — match every job number on the WK + NEK install
// schedules against production-jobs.import.csv and pull the production values.
//
// Outputs (seed-data/scheduling-hub/):
//   install-week-job-values.csv   one row per (region, employee, date, jobNumber) + production fields
//   install-week-job-values.md    readable rollup: distinct jobs + $ per region, unmatched list
//
// Run:  node seed-data/scripts/install-job-values.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '_source');
const OUT = join(__dirname, '..', 'scheduling-hub');

// ---- minimal RFC-4180 CSV parser -------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const csvText = readFileSync(join(SRC, 'production-jobs.import.csv'), 'utf8');
const rows = parseCsv(csvText);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const byJob = new Map();
for (let r = 1; r < rows.length; r++) {
  const jn = rows[r][idx.jobNumber];
  if (jn) byJob.set(jn, rows[r]);
}

const week = JSON.parse(readFileSync(join(SRC, 'install-schedule-week.json'), 'utf8'));

const get = (row, col) => (row ? row[idx[col]] ?? '' : '');
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const money = (n) => (n == null ? '' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));

// ---- walk the schedules -----------------------------------------------------
const PULL = ['jobName', 'currentStatus', 'value', 'installRegion', 'mfgRegion',
  'location', 'sales', 'vendor', 'scheduledInstall', 'dateInstalled', 'process', 'isActive'];
const csvCols = ['region', 'employee', 'crew', 'date', 'dayOfWeek', 'jobNumber',
  'scheduleCustomer', 'scheduleTask', 'matched', ...PULL];
const csvRows = [];
const distinct = new Map();      // jobNumber -> {row, regions:Set}
const unmatched = new Map();     // jobNumber -> reason  (real J# not in CSV)
const placeholders = [];         // schedule cells with no job number

for (const [code, region] of Object.entries(week.regions)) {
  for (const crew of region.crews) {
    for (const e of crew.entries) {
      const nums = e.jobNumbers || [];
      if (!nums.length) {
        placeholders.push({ region: code, employee: crew.employee, date: e.date,
          customer: e.customer || e.status || '', task: e.task || '', placeholder: !!e.placeholder });
        continue;
      }
      for (const jn of nums) {
        const row = byJob.get(jn);
        const matched = !!row;
        if (matched) {
          if (!distinct.has(jn)) distinct.set(jn, { row, regions: new Set() });
          distinct.get(jn).regions.add(code);
        } else if (!unmatched.has(jn)) {
          unmatched.set(jn, 'job number not found in production CSV');
        }
        csvRows.push([code, crew.employee, crew.crew || '', e.date, e.dayOfWeek, jn,
          e.customer || '', e.task || '', matched ? 'yes' : 'NO',
          ...PULL.map((c) => get(row, c))].map(cell));
      }
    }
  }
}
function cell(v) {
  const t = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
writeFileSync(join(OUT, 'install-week-job-values.csv'),
  [csvCols.join(','), ...csvRows.map((r) => r.join(','))].join('\n') + '\n');

// ---- markdown rollup --------------------------------------------------------
function regionTable(code) {
  const jobs = [...distinct.entries()]
    .filter(([, v]) => v.regions.has(code))
    .sort((a, b) => (num(get(b[1].row, 'value')) ?? 0) - (num(get(a[1].row, 'value')) ?? 0));
  let total = 0;
  const lines = jobs.map(([jn, v]) => {
    const val = num(get(v.row, 'value'));
    if (val) total += val;
    return `| ${jn} | ${get(v.row, 'jobName')} | ${get(v.row, 'currentStatus')} | ${get(v.row, 'installRegion')} | ${money(val)} |`;
  });
  return { md: lines.join('\n'), total, count: jobs.length };
}
const wk = regionTable('WK');
const nek = regionTable('NEK');
const noValue = [...distinct.entries()]
  .filter(([, v]) => num(get(v.row, 'value')) == null)
  .map(([jn]) => jn);

const md = `# Install week ${week.weekStart} → ${week.weekEnd} — production values

Job numbers on the WK + NEK install schedules, matched against
\`production-jobs.import.csv\` (728 jobs). Per-line detail is in
\`install-week-job-values.csv\`.

- **Distinct scheduled jobs matched:** ${distinct.size}
- **Total scheduled value (distinct jobs):** ${money(wk.total + nek.total)}
- **Unmatched job numbers:** ${unmatched.size}
- **Matched but no \`value\` in the CSV** (data gap, counts as $0): ${noValue.length}${noValue.length ? ` — ${noValue.join(', ')}` : ''}
- **Schedule cells with no job number (can't match):** ${placeholders.length} (mostly NEK \`NKC-018\` template cells)

## WK — ${wk.count} jobs · ${money(wk.total)}

| Job # | Name | Current Status | Install Region | Value |
|---|---|---|---|---|
${wk.md}

## NEK — ${nek.count} jobs · ${money(nek.total)}

| Job # | Name | Current Status | Install Region | Value |
|---|---|---|---|---|
${nek.md}

${unmatched.size ? `## Unmatched job numbers (on schedule, not in CSV)\n\n${[...unmatched.keys()].map((j) => `- ${j}`).join('\n')}\n` : ''}
## Unmatchable schedule cells (no job number)

These install rows have no job number on the sheet, so there's nothing to look up.
NEK is largely an unfilled template this week (\`NKC-018 / "A lot of numbers"\`).

| Region | Employee | Date | Customer / Status | Task | Template? |
|---|---|---|---|---|---|
${placeholders.map((p) => `| ${p.region} | ${p.employee} | ${p.date} | ${p.customer} | ${p.task} | ${p.placeholder ? 'yes' : ''} |`).join('\n')}
`;
writeFileSync(join(OUT, 'install-week-job-values.md'), md);

// ---- console summary --------------------------------------------------------
console.log(`Per-line rows:            ${csvRows.length}`);
console.log(`Distinct jobs matched:    ${distinct.size}  (WK ${wk.count} / NEK ${nek.count})`);
console.log(`Total scheduled value:    ${money(wk.total + nek.total)}  (WK ${money(wk.total)} / NEK ${money(nek.total)})`);
console.log(`Unmatched job numbers:    ${unmatched.size}${unmatched.size ? ' -> ' + [...unmatched.keys()].join(', ') : ''}`);
console.log(`No-job-number cells:      ${placeholders.length}`);
