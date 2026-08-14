// PDF export: a self-contained calculation report — title block, design
// criteria, wind force table, pole/footing/base-plate results, the elevation
// sketch (rasterized from the shared SketchSvg), and the standard spec notes.
// Generated fully client-side with jsPDF; no server round trip.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';

import type { DesignInput, DesignResult } from './engine';
import { EXPOSURE_DESCRIPTIONS, SHAPE_LABELS, SHAPE_SPECS, SPEC_NOTES, isAluminum, isRound } from '../data/tables';
import { fmt, fmtFtIn, fmtInt } from '../ui/fields';
import { SKETCH_PALETTES, SKETCH_VB_H, SKETCH_VB_W, SketchSvg, sketchAvailable } from '../ui/SketchSvg';

const PAGE_W = 612; // letter, pt
const PAGE_H = 792;
const M = 48;
const CONTENT_W = PAGE_W - 2 * M;

// Design-token colors (light theme) for the report chrome.
const INK = '#1f1f2e';
const MID = '#4a4f5e';
const DIM = '#8b91a3';
const BRAND = '#141464';
const RED = '#E8151B';
const BORDER = '#e4e5ea';
const AMBER = '#f2994a';
const AMBER_SOFT = '#fdf0d9';
const GREEN = '#0f6e56';

async function rasterizeSketch(input: DesignInput, result: DesignResult): Promise<string | null> {
  if (!sketchAvailable(result)) return null;
  const markup = renderToStaticMarkup(
    createElement(SketchSvg, {
      input,
      result,
      palette: SKETCH_PALETTES.light,
      background: '#ffffff',
      idPrefix: 'pdf-sk',
    }),
  );
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('sketch rasterization failed'));
      i.src = url;
    });
    const scale = 2; // 2x for crisp print
    const canvas = document.createElement('canvas');
    canvas.width = SKETCH_VB_W * scale;
    canvas.height = SKETCH_VB_H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // JPEG keeps the file ~20× smaller than PNG here; at 2× resolution the
    // compression artifacts are invisible once scaled to page width.
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function slugify(s: string): string {
  const slug = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'calc';
}

export async function exportPdfReport(input: DesignInput, result: DesignResult): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = M;

  const setFont = (size: number, weight: 'normal' | 'bold' = 'normal', color = INK) => {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_H - M - 18) {
      doc.addPage();
      y = M;
    }
  };

  const sectionTitle = (title: string) => {
    ensureRoom(34);
    y += 14;
    setFont(9, 'bold', DIM);
    doc.text(title.toUpperCase(), M, y);
    y += 5;
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.75);
    doc.line(M, y, PAGE_W - M, y);
    y += 12;
  };

  const kv = (label: string, value: string, x: number, width: number) => {
    setFont(7.5, 'bold', DIM);
    doc.text(label.toUpperCase(), x, y);
    setFont(9.5, 'bold', INK);
    doc.text(doc.splitTextToSize(value, width) as string[], x, y + 11);
  };

  const row = (label: string, value: string, status?: 'OK' | 'NG') => {
    const lines = doc.splitTextToSize(value, CONTENT_W - 150) as string[];
    const h = Math.max(12, lines.length * 10 + 2);
    ensureRoom(h + 4);
    setFont(7.5, 'bold', DIM);
    doc.text(label.toUpperCase(), M, y);
    setFont(9, 'normal', INK);
    doc.text(lines, M + 118, y);
    if (status) {
      setFont(8, 'bold', status === 'OK' ? GREEN : RED);
      doc.text(status, PAGE_W - M, y, { align: 'right' });
    }
    y += h;
  };

  // ── Title block ───────────────────────────────────────────────────────────
  // Ray-mark logo: red rounded square, white rays from the bottom-left.
  const logo = 30;
  doc.setFillColor(RED);
  doc.roundedRect(M, y, logo, logo, 2.5, 2.5, 'F');
  doc.setDrawColor('#ffffff');
  doc.setLineWidth(1.2);
  doc.setLineCap('round');
  const s = logo / 88;
  const ox = M + 3 * s;
  const oy = y + 85 * s;
  for (const [tx, ty] of [[90, 4], [88, 20], [82, 36], [72, 52], [58, 66], [40, 76], [20, 82]] as const) {
    doc.line(ox, oy, M + tx * s, y + ty * s);
  }

  setFont(13, 'bold', INK);
  doc.text('LUMINEO SIGNS', M + logo + 12, y + 12);
  setFont(7.5, 'bold', DIM);
  doc.text('SWITCHBOARD · WIND LOAD CALCULATION', M + logo + 12, y + 24);
  setFont(8.5, 'normal', DIM);
  doc.text(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    PAGE_W - M,
    y + 12,
    { align: 'right' },
  );
  y += logo + 20;

  setFont(16, 'bold', INK);
  doc.text(input.projectName.trim() || 'Untitled project', M, y);
  y += 14;
  if (input.description.trim()) {
    setFont(9.5, 'normal', MID);
    doc.text(doc.splitTextToSize(input.description.trim(), CONTENT_W) as string[], M, y);
    y += 12;
  }

  // Disclaimer band.
  const disc =
    'PRELIMINARY SIZING ONLY — calculations follow the shop’s UBC 1994 / AISC 9th ed. workbook. ' +
    'Final structural design and permit drawings must be prepared or verified by a licensed engineer.';
  const discLines = doc.splitTextToSize(disc, CONTENT_W - 20) as string[];
  const discH = discLines.length * 9 + 12;
  doc.setFillColor(AMBER_SOFT);
  doc.setDrawColor(AMBER);
  doc.setLineWidth(0.75);
  doc.roundedRect(M, y, CONTENT_W, discH, 4, 4, 'FD');
  setFont(7.5, 'bold', MID);
  doc.text(discLines, M + 10, y + 13);
  y += discH + 4;

  // ── Design criteria ───────────────────────────────────────────────────────
  sectionTitle('Design criteria');
  ensureRoom(30);
  const col = CONTENT_W / 4;
  kv('Basic wind speed', `${fmt(input.windSpeedMph)} mph`, M, col - 10);
  kv('Exposure', `${input.exposure}`, M + col, col - 10);
  kv('qs = 0.00256 V²', `${fmt(result.qsPsf, 2)} psf`, M + 2 * col, col - 10);
  kv('Cq (signs)', `${fmt(input.cq)}`, M + 3 * col, col - 10);
  y += 28;
  kv('Seismic zone', `${input.seismicZone} (Fp ${fmt(result.seismic.fpPsf, 1)} psf)`, M, col - 10);
  kv('Stress increase', `×${fmt(input.stressIncrease)} wind`, M + col, col - 10);
  kv('Lateral soil', `${fmt(input.lateralSoilPsf)} psf/ft`, M + 2 * col, col - 10);
  kv('Allow. bearing', `${fmt(input.bearingPsf)} psf`, M + 3 * col, col - 10);
  y += 28;
  setFont(8, 'normal', DIM);
  doc.text(`Exposure ${input.exposure}: ${EXPOSURE_DESCRIPTIONS[input.exposure]}`, M, y);
  y += 8;

  // ── Wind forces table ─────────────────────────────────────────────────────
  sectionTitle('Wind forces by element');
  const cols = [
    { h: 'Element', w: 118, align: 'left' as const },
    { h: 'W × H (ft)', w: 66, align: 'right' as const },
    { h: 'Area (sf)', w: 56, align: 'right' as const },
    { h: 'Centroid (ft)', w: 68, align: 'right' as const },
    { h: 'Press. (psf)', w: 64, align: 'right' as const },
    { h: 'Force (lb)', w: 62, align: 'right' as const },
    { h: 'Moment (lb-ft)', w: 82, align: 'right' as const },
  ];
  const xs: number[] = [];
  let cxx = M;
  for (const c of cols) { xs.push(cxx); cxx += c.w; }
  const cellX = (i: number) => (cols[i].align === 'right' ? xs[i] + cols[i].w - 4 : xs[i]);

  ensureRoom(20);
  setFont(7.5, 'bold', DIM);
  cols.forEach((c, i) => doc.text(c.h.toUpperCase(), cellX(i), y, { align: cols[i].align }));
  y += 5;
  doc.setDrawColor(BORDER);
  doc.line(M, y, M + CONTENT_W, y);
  y += 11;

  for (const e of result.elements) {
    ensureRoom(14);
    setFont(9, 'normal', INK);
    const vals = [
      e.label || '—',
      `${fmt(e.widthFt)} × ${fmt(e.heightFt)}`,
      fmt(e.areaSqFt, 1),
      fmt(e.centroidFt, 1),
      fmt(e.pressurePsf, 1),
      fmtInt(e.forceLb),
      fmtInt(e.momentLbFt),
    ];
    vals.forEach((v, i) => doc.text(v, cellX(i), y, { align: cols[i].align }));
    y += 13;
  }
  doc.setDrawColor(BORDER);
  doc.line(M, y - 8, M + CONTENT_W, y - 8);
  setFont(9, 'bold', INK);
  doc.text('Total', cellX(0), y + 3);
  doc.text(fmt(result.totalAreaSqFt, 1), cellX(2), y + 3, { align: 'right' });
  doc.text(fmtInt(result.shearAtGradeLb), cellX(5), y + 3, { align: 'right' });
  doc.text(fmtInt(result.momentAtGradeLbFt), cellX(6), y + 3, { align: 'right' });
  y += 12;

  // ── Pole ─────────────────────────────────────────────────────────────────
  const c = result.column;
  sectionTitle(c.mode === 'manual' ? 'Pole (specified size)' : 'Recommended pole');
  if (c.section) {
    setFont(12, 'bold', BRAND);
    ensureRoom(16);
    doc.text(
      `${input.numColumns} × ${SHAPE_LABELS[input.columnType].short} ${c.section.name}` +
        (c.ok ? '' : '  — OVERSTRESSED'),
      M,
      y,
    );
    y += 16;
    if (c.mode === 'manual' && c.autoSection) {
      row(
        'Sizing',
        c.autoSection.name === c.section.name
          ? 'Specified by the estimator — matches the calculated recommendation.'
          : `Specified by the estimator · calculated recommendation is ${c.autoSection.name} (${fmt(c.autoSection.sm)} in³)`,
      );
    }
    row('Section modulus', `${fmt(c.requiredSm)} in³ required · ${fmt(c.section.sm)} in³ provided (per pole)`);
    row(
      'Bending stress',
      c.FbKsi !== null
        ? `fb ${fmt(c.fbKsi ?? 0)} ksi vs Fb ${fmt(c.FbKsi)} ksi (incl. ×${fmt(input.stressIncrease)} wind increase) — ${fmt((c.utilization ?? 0) * 100, 0)}% utilized`
        : `fb ${fmt(c.fbKsi ?? 0)} ksi — slender section, verify with an engineer`,
      c.ok ? 'OK' : 'NG',
    );
    row('Size', `${fmt(c.section.odIn, 3)}" ${isRound(input.columnType) ? 'OD' : 'square'} × ${fmt(c.section.wallIn, 4)}" wall · ${fmt(c.section.areaSqIn)} in² ${isAluminum(input.columnType) ? 'aluminum' : 'steel'} · ${SHAPE_SPECS[input.columnType]}`);
    if (c.section.sleeveIn !== null) row('Splice sleeve', `${c.section.sleeveIn}" deep (if a stepped column is used)`);
  } else {
    row('Result', 'No standard pipe/tube size carries this load — add poles or reduce the sign.');
  }

  // ── Footing ──────────────────────────────────────────────────────────────
  const f = result.footing;
  if (f) {
    sectionTitle(input.footingType === 'round' ? 'Round caisson footing' : 'Rectangular pier footing');
    setFont(12, 'bold', BRAND);
    ensureRoom(16);
    doc.text(
      input.footingType === 'round'
        ? `${input.numFootings} × Ø ${fmt(f.diameterFt)}' × ${fmtFtIn(f.depthFt)} deep`
        : `${input.numFootings} × ${fmt(f.planWidthFt)}' × ${fmt(f.planLengthFt)}' × ${fmtFtIn(f.depthFt)} deep`,
      M,
      y,
    );
    y += 16;
    row('Embedment', `${fmt(f.depthFt)} ft required (UBC 1806.7, nonconstrained)`);
    row('Design load', `M ${fmtInt(f.momentPerFootingLbFt)} lb-ft / footing · P = M/h = ${fmtInt(f.equivalentLoadLb)} lb at h ${fmt(f.centroidFt, 1)} ft`);
    row('Lateral soil', `S1 ${fmtInt(f.s1Psf)} psf at D/3 (2 × ${fmtInt(input.lateralSoilPsf)} psf/ft, isolated pole)`);
    row('Soil bearing', `q max ${fmtInt(f.qMaxPsf)} psf vs allowed ${fmtInt(f.qAllowedPsf)} psf`, f.bearingOk ? 'OK' : 'NG');
    if (result.column.section) {
      row(
        'Concrete cover',
        `needs ≥ ${fmt(f.minWidthForCoverFt)}' across for 3" cover around the ${fmt(result.column.section.odIn, 3)}" pole`,
        f.coverOk ? 'OK' : 'NG',
      );
    }
    row('Concrete', `${fmt(f.volumePerFootingYd3, 2)} yd³ / footing · ${fmt(f.totalVolumeYd3, 2)} yd³ all footings (±)`);
    const mp = result.mowPad;
    if (mp) {
      row(
        'Mow pad',
        `${fmt(input.mowPad.lengthFt)}' along face × ${fmt(input.mowPad.widthFt)}' across × ${fmt(input.mowPad.heightIn, 2)}" tall on soil · ` +
          `${fmt(mp.volumeYd3, 2)} yd³ · needs ≥ ${fmt(mp.requiredLengthFt)}' × ${fmt(mp.requiredWidthFt)}' (footing + 6")`,
        mp.sizeOk ? 'OK' : 'NG',
      );
      row('Total concrete', `order ${fmt(Math.ceil((f.totalVolumeYd3 + mp.volumeYd3) * 2) / 2, 1)} yd³ (footings ${fmt(f.totalVolumeYd3, 2)} + pad ${fmt(mp.volumeYd3, 2)}) (±)`);
    } else {
      row('Total concrete', `order ${fmt(Math.ceil(f.totalVolumeYd3 * 2) / 2, 1)} yd³ (±)`);
    }
  }

  // ── Pole length / transition splice ──────────────────────────────────────
  const pl = result.poleLength;
  const tr = result.transition;
  if (pl && result.column.section) {
    sectionTitle('Pole length & transition');
    row(
      'Pole length',
      `${fmtFtIn(pl.totalFt)} total (${fmtFtIn(pl.embedFt)} embedded + ${fmtFtIn(pl.totalFt - pl.embedFt)} above grade) · order max 40', haul max 30'`,
      tr ? undefined : pl.haulOk ? 'OK' : 'NG',
    );
    if (tr) {
      if (tr.section) {
        row('Splice', `${fmtFtIn(tr.spliceFt)} above grade · upper pipe extends ${fmt(tr.overlapFt)}' inside the base pipe`);
        row('Upper pipe', `${input.numColumns} × ${SHAPE_LABELS[input.columnType].short} ${tr.section.name} · ${fmt(tr.section.odIn, 3)}" OD fits ${fmt(tr.baseIdIn, 3)}" base ID`, tr.ok ? 'OK' : 'NG');
        row('Piece lengths', `base ${fmtFtIn(tr.basePipeFt)} · upper ${fmtFtIn(tr.upperPipeFt)} (incl. ${fmt(tr.overlapFt)}' overlap)`, tr.orderOk && tr.haulOk ? 'OK' : 'NG');
        row('Moment at splice', `${fmtInt(tr.momentAtSpliceLbFt)} lb-ft → ${fmt(tr.requiredSm)} in³ required per pole`);
        row('Ring plates', `1/2" steel · outer Ø ${fmt(tr.ringOuterOdIn, 2)}" welded to top of base pipe · inner Ø ${fmt(tr.ringInnerOdIn, 2)}" snug in base pipe ID${tr.ringBoreIn ? ` · bored Ø ${fmt(tr.ringBoreIn, 2)}" for the upper pipe` : ''}`);
      } else {
        row('Splice', 'No standard upper size both carries the splice moment and fits inside the base pipe ID.', 'NG');
      }
    } else if (!pl.haulOk) {
      row('Recommendation', `Pole exceeds the ${pl.orderOk ? '30 ft haul limit' : '40 ft order limit'} — use a transition pipe.`, 'NG');
    }
  }

  // ── Base plate ───────────────────────────────────────────────────────────
  const bp = result.basePlate;
  if (bp) {
    sectionTitle('Base plate & anchor bolts');
    setFont(12, 'bold', BRAND);
    ensureRoom(16);
    doc.text(`PL ${fmt(bp.plateNIn, 1)}" × ${fmt(bp.plateBIn, 1)}" × ${fmt(Math.ceil(bp.plateThicknessIn * 8) / 8, 3)}"`, M, y);
    y += 16;
    row('Plate thickness', `${fmt(bp.plateThicknessIn, 3)}" calculated (without gussets) · per plate M ${fmtInt(bp.momentPerPlateLbFt)} lb-ft`);
    row('Anchor bolts', `${2 * input.basePlate.boltsPerLine} per plate · Ø ${fmt(bp.boltDiaIn, 3)}" A36 rod (min ${fmt(bp.minBoltDiaIn, 3)}") · embed ${fmt(bp.embedLengthIn, 1)}"`);
    row('Bolt spacing', `lines at ${fmt(bp.boltLineSpacingIn, 1)}" · in-line ${fmt(bp.boltSpacingIn, 1)}" (min ${fmt(bp.minBoltSpacingIn, 1)}") · edge ≥ ${fmt(bp.minEdgeSpacingIn, 1)}"`);
    row('Concrete cone', `capacity ${fmtInt(bp.coneCapacityLb)} lb vs ${fmtInt(bp.tensionPerAnchorLb)} lb / anchor`, bp.coneOk ? 'OK' : 'NG');
    row('Tension + shear', `ft ${fmtInt(bp.actualTensionPsi)} psi vs allowed ${fmtInt(bp.allowedTensionPsi)} psi (fv ${fmtInt(bp.shearStressPsi)} psi)`, bp.tensionOk ? 'OK' : 'NG');
    row('Column weld', `${fmt(input.basePlate.weldLegIn, 4)}" fillet · fw ${fmtInt(bp.weldStressPsi)} psi vs 21,000 psi (E70XX)`, bp.weldOk ? 'OK' : 'NG');
  }

  // Warnings / errors.
  if (result.errors.length > 0 || result.warnings.length > 0) {
    sectionTitle('Notes & warnings');
    for (const e of result.errors) {
      ensureRoom(12);
      setFont(8.5, 'bold', RED);
      doc.text(doc.splitTextToSize(`• ${e}`, CONTENT_W) as string[], M, y);
      y += 12;
    }
    for (const w of result.warnings) {
      ensureRoom(12);
      setFont(8.5, 'normal', MID);
      doc.text(doc.splitTextToSize(`• ${w}`, CONTENT_W) as string[], M, y);
      y += 12;
    }
  }

  // ── Elevation sketch (own page) ───────────────────────────────────────────
  const sketchPng = await rasterizeSketch(input, result);
  if (sketchPng) {
    doc.addPage();
    y = M;
    sectionTitle('Elevation sketch');
    const imgW = CONTENT_W;
    const imgH = imgW * (SKETCH_VB_H / SKETCH_VB_W);
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.75);
    doc.rect(M, y, imgW, imgH);
    doc.addImage(sketchPng, 'JPEG', M, y, imgW, imgH);
    y += imgH + 10;
    setFont(8, 'normal', DIM);
    doc.text(
      'Proportions to scale from the calculated design; thin poles/footings widened slightly for clarity. Pier length runs perpendicular to the sign face.',
      M,
      y,
    );
    y += 10;
  }

  // ── Specifications ────────────────────────────────────────────────────────
  sectionTitle('Standard specifications');
  const specBlock = (title: string, items: readonly string[]) => {
    ensureRoom(24);
    setFont(8.5, 'bold', INK);
    doc.text(title, M, y);
    y += 11;
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, CONTENT_W - 8) as string[];
      ensureRoom(lines.length * 9 + 2);
      setFont(8, 'normal', MID);
      doc.text(lines, M + 6, y);
      y += lines.length * 9 + 2;
    }
    y += 6;
  };
  specBlock('Steel', SPEC_NOTES.steel);
  specBlock('Welding', SPEC_NOTES.welding);
  specBlock('Concrete', SPEC_NOTES.concrete);

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setFont(7.5, 'normal', DIM);
    doc.text(
      `Lumineo Signs · Wind Load Calculator · preliminary sizing only — verify with a licensed engineer`,
      M,
      PAGE_H - 24,
    );
    doc.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 24, { align: 'right' });
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`wind-load-${slugify(input.projectName)}-${date}.pdf`);
}
