// One-time script: parses the Airtable CSV export → src/data/staticRecords.ts
// Run: node scripts/generate-static-data.cjs
'use strict';
const fs   = require('fs');
const path = require('path');

// ── CSV parser (handles quoted fields with embedded newlines / doubled quotes) ──
function parseCSV(text) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { field += '"'; i++; }
      else if (ch === '"')          { inQ = false; }
      else                          { field += ch; }
    } else {
      if      (ch === '"')                    { inQ = true; }
      else if (ch === ',')                    { cur.push(field); field = ''; }
      else if (ch === '\r' && nx === '\n')    { cur.push(field); rows.push(cur); cur = []; field = ''; i++; }
      else if (ch === '\n')                   { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else                                    { field += ch; }
    }
  }
  if (cur.length || field) { cur.push(field); rows.push(cur); }
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(s) {
  if (!s || !s.trim()) return '';
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
}
function parseNum(s) {
  if (!s || !s.trim()) return null;
  const n = parseFloat(s.replace(/[$,]/g,''));
  return isNaN(n) ? null : n;
}
function parseBool(s) {
  return /^(true|1|x|yes|checked)$/i.test((s||'').trim());
}
// For multi-value select fields (comma-separated), take first value
function first(s) {
  if (!s) return '';
  return s.split(',')[0].trim();
}
// Strip attachment URLs — keep only the filename before " (http"
function attachmentLabel(s) {
  if (!s) return '';
  // Multiple attachments are comma-separated: "file1.pdf (url), file2.pdf (url)"
  // Return just the first filename
  const part = s.split(',')[0].trim();
  const paren = part.indexOf(' (http');
  return paren > -1 ? part.slice(0, paren).trim() : part;
}

// ── Parse ─────────────────────────────────────────────────────────────────────
const CSV_PATH = path.join('C:\\', 'Users', 'Alex', 'Downloads', 'LNI Production Schedule-LNI - Master (1).csv');
const text = fs.readFileSync(CSV_PATH, 'utf-8');
const [headerRow, ...dataRows] = parseCSV(text);

// Build header index map (strip BOM from first header)
const H = {};
headerRow.forEach((h, i) => { H[h.trim().replace(/^﻿/, '')] = i; });

function g(row, name) {
  const idx = H[name];
  return (idx !== undefined && row[idx] != null) ? row[idx].trim() : '';
}

const records = dataRows
  .filter(row => row.some(f => f.trim()))   // skip blank rows
  .map((row, i) => ({
    id:               `csv-${i + 1}`,
    job:              g(row, 'Job # / Name'),
    status:           g(row, 'Current Status'),
    process:          g(row, 'Process'),
    priority:         g(row, 'Priority'),
    region:           g(row, 'Region'),
    sales:            g(row, 'Sales').replace(/,\s*/g, ','), // keep all comma-separated reps
    signType:         '',
    location:         g(row, 'Location'),
    orderDate:        parseDate(g(row, 'Order Date (Received)')),
    expeditor:        parseDate(g(row, 'Expeditor')),
    scheduledInstall: parseDate(g(row, 'Scheduled Install')),
    mfgTargetMod:     parseDate(g(row, 'Mfg Target Modified')),
    redDate:          parseDate(g(row, 'RED DATE')),
    vendorShipDate:   parseDate(g(row, 'Vendor Ship Date')),
    value:            parseNum(g(row, 'Value')),
    dip:              null,
    totalMfg:         parseNum(g(row, 'Total Hrs Mfg')),
    totalInstall:     parseNum(g(row, 'Total Hrs Install')),
    readyInstall:     g(row, 'Ready for Install'),
    powerlines:       g(row, 'Powerlines'),
    locates:          g(row, 'Locates'),
    mfgRegion:        g(row, 'MFG Region'),
    installRegion:    g(row, 'Install Region'),
    installArea:      '',
    vendor:           first(g(row, 'Vendor')),
    po:               g(row, 'P.O. #'),
    vendorStatus:     g(row, 'Vendor Status'),
    graphics:         first(g(row, 'Graphics')),
    routingType:      g(row, 'Routing Type'),
    metal:            g(row, 'Metal'),
    assembly:         g(row, 'Assembly'),
    plex:             g(row, 'Plex/Application'),
    paintPrep:        g(row, 'Paint Prep/Paint'),
    materialCut:      g(row, 'Material Cut'),
    paintPrepHrs:     parseNum(g(row, 'Paint Prep')),
    paintHrs:         parseNum(g(row, 'Paint')),
    steelHrs:         parseNum(g(row, 'Steel')),
    installHrs:       parseNum(g(row, 'Install')),
    travelHrs:        parseNum(g(row, 'Travel')),
    routingHrs:       parseNum(g(row, 'Routing Hrs')),
    ulSign:           parseBool(g(row, 'UL Sign')),
    qt:               parseBool(g(row, 'Q.T.')),
    deposit:          g(row, 'Deposit'),
    storageLocation:  g(row, 'Storage Location'),
    notes:            g(row, 'Job Notes'),
    adminNotes:       g(row, 'Admin Notes'),
    mfgNotes:         g(row, 'Mfg Notes'),
    description:      g(row, 'Description'),
    mfgFinalDate:     parseDate(g(row, 'Mfg Final Date') || g(row, 'Mfg Target')),
    dateToHold:       parseDate(g(row, 'Date to Hold')),
    dateOffHold:      parseDate(g(row, 'Date off Hold')),
    dateInstalled:    parseDate(g(row, 'Date Installed')),
    dateToAdmin:      parseDate(g(row, 'Date to Admin')),
    vendorShipDate2:  parseDate(g(row, '2nd Vendor Ship Date')),
    outsourcedArrival:parseDate(g(row, 'Outsourced Arrival')),
    paintPrepDueMod:  parseDate(g(row, 'Paint Prep/Paint - Due Date Modified')),
    cutVinylColor:    g(row, 'Cut Vinyl Color'),
    vinylProd:        g(row, 'Vinyl Prod / Install/ Patterns'),
    // Scheduling dates
    mfgTarget:        parseDate(g(row, 'Mfg Target')),
    installTarget:    parseDate(g(row, 'Install Target')),
    billDayJob:       parseDate(g(row, 'Bill Day Job')),
    // Workflow tracking
    sketch:           attachmentLabel(g(row, 'Sketch')),
    routingOrdered:   parseDate(g(row, 'Routing Ordered')),
    vinylOrdered:     parseDate(g(row, 'Vinyl Ordered')),
    vinylComplete:    parseDate(g(row, 'Vinyl - Complete')),
    routingComplete:  parseDate(g(row, 'Routing Complete')),
    mfgComplete:      parseDate(g(row, 'Mfg - Complete')),
    dateInvoiced:     parseDate(g(row, 'Date Invoiced')),
    vinylDueDate:     parseDate(g(row, 'Vinyl Due Date')),
    vinylProdStartDate: parseDate(g(row, 'Vinyl Prod. Start Date')),
    // Notes / supplemental
    graphicsNotes:    g(row, 'Graphics Notes'),
    emcContent:       g(row, 'EMC Content'),
    mfgRating:        g(row, 'MFG Rating'),
    // DIP sub-metrics
    adjustedDip:      parseNum(g(row, 'Adjusted DIP - Off Hold')),
    mfgDip:           parseNum(g(row, 'Mfg. DIP')),
  }))
  .filter(r => r.job);   // drop any row that ended up with no job name

const outPath = path.join(__dirname, '..', 'src', 'data', 'staticRecords.ts');
fs.writeFileSync(outPath,
`// AUTO-GENERATED — do not edit by hand.
// Re-generate: node scripts/generate-static-data.cjs
import type { LniRecord } from '../types/schema';

export const STATIC_RECORDS: LniRecord[] = ${JSON.stringify(records, null, 2)};
`);

console.log(`✓ Generated ${records.length} records → src/data/staticRecords.ts`);
