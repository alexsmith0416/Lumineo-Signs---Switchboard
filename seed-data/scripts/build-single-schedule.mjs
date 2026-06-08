// build-single-schedule.mjs — ONE consolidated file: the full 6/8 install week,
// both regions, ordered by day, with production values joined for every job
// number that matched production-jobs.import.csv.
//
// Output: seed-data/install-week-schedule.csv
// Run:    node seed-data/scripts/build-single-schedule.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '_source');
const OUT = join(__dirname, '..', 'install-week-schedule.csv');

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(join(SRC, 'production-jobs.import.csv'), 'utf8'));
const idx = Object.fromEntries(rows[0].map((h, i) => [h, i]));
const byJob = new Map();
for (let r = 1; r < rows.length; r++) byJob.set(rows[r][idx.jobNumber], rows[r]);

const week = JSON.parse(readFileSync(join(SRC, 'install-schedule-week.json'), 'utf8'));
const get = (row, col) => (row ? (row[idx[col]] ?? '') : '');
const cell = (v) => {
  const t = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const REGION_ORDER = { WK: 0, NEK: 1 };

const out = [];
for (const [code, region] of Object.entries(week.regions)) {
  for (const crew of region.crews) {
    for (const e of crew.entries) {
      const base = {
        date: e.date, dayOfWeek: e.dayOfWeek, region: code,
        employee: crew.employee, crew: crew.crew || '',
        customer: e.customer || '', task: e.task || e.status || '',
        note: e.note || '', placeholder: e.placeholder ? 'yes' : '',
      };
      const nums = e.jobNumbers || [];
      if (!nums.length) {
        out.push({ ...base, jobNumber: '', jobName: '', currentStatus: e.status || '',
          installRegion: '', value: '', matched: '' });
      } else {
        for (const jn of nums) {
          const row = byJob.get(jn);
          out.push({ ...base, jobNumber: jn, jobName: get(row, 'jobName'),
            currentStatus: get(row, 'currentStatus'), installRegion: get(row, 'installRegion'),
            value: get(row, 'value'), matched: row ? 'yes' : 'NO' });
        }
      }
    }
  }
}

// order by day, then region (WK before NEK), then employee
out.sort((a, b) =>
  a.date.localeCompare(b.date) ||
  (REGION_ORDER[a.region] - REGION_ORDER[b.region]) ||
  a.employee.localeCompare(b.employee));

const cols = ['date', 'dayOfWeek', 'region', 'employee', 'crew', 'jobNumber', 'jobName',
  'customer', 'task', 'currentStatus', 'installRegion', 'value', 'matched', 'note', 'placeholder'];
const csv = [cols.join(','), ...out.map((o) => cols.map((c) => cell(o[c])).join(','))].join('\n') + '\n';
writeFileSync(OUT, csv);

const withJob = out.filter((o) => o.jobNumber).length;
const withVal = out.filter((o) => o.value).length;
console.log(`Rows: ${out.length}  (job rows ${withJob}, with value ${withVal})  -> ${OUT}`);
