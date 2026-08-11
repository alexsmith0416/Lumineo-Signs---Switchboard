import { useEffect, useMemo, useState } from 'react';

import { computeDesign, type DesignInput } from '../lib/engine';
import { InputsPanel, newElement } from './InputsPanel';
import { ResultsPanel } from './ResultsPanel';
import { SketchPanel } from './SketchPanel';
import { SpecsView } from './SpecsView';
import { Topbar, type View } from './Topbar';
import { useTheme } from './useTheme';

const STORAGE_KEY = 'lumineo-windload-design-v1';

function defaultInput(): DesignInput {
  return {
    projectName: '',
    description: '',
    windSpeedMph: 115,
    exposure: 'C',
    cq: 1.4,
    seismicZone: 3,
    elements: [{ ...newElement(), label: 'Sign cabinet', widthFt: 10, heightFt: 5, topFt: 20 }],
    numColumns: 1,
    columnType: 'P',
    columnSizing: 'auto',
    columnSizeName: null,
    stressIncrease: 1.33,
    footingType: 'round',
    numFootings: 1,
    lateralSoilPsf: 200,
    bearingPsf: 1330,
    caissonDiaFt: 2.5,
    pierWidthFt: 3,
    pierLengthFt: 3,
    signWeightLb: null,
    mowPad: {
      enabled: false,
      widthFt: 4,
      lengthFt: 12,
      heightIn: 5.5,
    },
    transition: {
      enabled: false,
      spliceFt: null,
    },
    basePlate: {
      enabled: false,
      boltsPerLine: 2,
      fcPsi: 2500,
      boltDiaIn: null,
      boltSpacingIn: null,
      weldLegIn: 0.3125,
    },
  };
}

function loadSaved(): DesignInput {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return defaultInput();
    const parsed = JSON.parse(raw) as Partial<DesignInput>;
    // Merge over defaults so newly added fields pick up sane values.
    const base = defaultInput();
    return {
      ...base,
      ...parsed,
      elements: Array.isArray(parsed.elements) && parsed.elements.length > 0
        ? parsed.elements
        : base.elements,
      mowPad: { ...base.mowPad, ...(parsed.mowPad ?? {}) },
      transition: { ...base.transition, ...(parsed.transition ?? {}) },
      basePlate: { ...base.basePlate, ...(parsed.basePlate ?? {}) },
    };
  } catch {
    return defaultInput();
  }
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState<DesignInput>(loadSaved);
  const [view, setView] = useState<View>('calc');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Autosave inputs so a refresh doesn't lose the design in progress.
  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* ignore storage failures */
    }
  }, [input]);

  const result = useMemo(() => computeDesign(input), [input]);

  function reset() {
    if (window.confirm('Reset all inputs to defaults?')) setInput(defaultInput());
  }

  async function exportPdf() {
    if (result.momentAtGradeLbFt <= 0) {
      window.alert('Enter the sign face dimensions first — there is nothing to report yet.');
      return;
    }
    setExportingPdf(true);
    try {
      // Lazy-loaded so jsPDF stays out of the main bundle.
      const { exportPdfReport } = await import('../lib/pdfReport');
      await exportPdfReport(input, result);
    } catch (e) {
      console.error('[App] PDF export failed', e);
      window.alert('PDF export failed — see the browser console for details.');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="app-body">
      <Topbar
        projectName={input.projectName}
        view={view}
        theme={theme}
        exportingPdf={exportingPdf}
        onChangeView={setView}
        onToggleTheme={toggleTheme}
        onPrint={() => window.print()}
        onExportPdf={exportPdf}
        onReset={reset}
      />

      <main className="app-main">
        {/* Print-only header so a printed summary identifies the job. */}
        <div className="print-header">
          <p className="tb-eyebrow">LUMINEO SIGNS · WIND LOAD CALCULATION</p>
          <h1>{input.projectName.trim() || 'Untitled project'}</h1>
          {input.description.trim() && <p className="muted">{input.description}</p>}
          <p className="muted">
            Wind {input.windSpeedMph} mph · Exposure {input.exposure} · Cq {input.cq} · UBC 1994
          </p>
        </div>

        {view === 'specs' ? (
          <SpecsView />
        ) : (
          <div className="calc-grid">
            <InputsPanel
              input={input}
              onChange={setInput}
              recommendedSizeName={result.column.autoSection?.name ?? null}
            />
            {view === 'calc' ? (
              <ResultsPanel input={input} result={result} />
            ) : (
              <SketchPanel input={input} result={result} theme={theme} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
