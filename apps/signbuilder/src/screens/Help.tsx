/**
 * Help — embeds the brand user guide (public/USER-GUIDE.html, shipped in the
 * bundle) with Open in new tab / Download PDF, and launches the demo sandbox +
 * guided tour. Same layout as Switchboard's Help.
 */
const GUIDE_URL = `${import.meta.env.BASE_URL}USER-GUIDE.html`;

export default function Help({ onLaunchDemo }: { onLaunchDemo?: () => void }) {
  return (
    <div className="help-screen">
      {onLaunchDemo && (
        <div className="help-demo-cta">
          <div className="help-demo-cta__text">
            <div className="help-demo-cta__title">Try the interactive demo</div>
            <div className="help-demo-cta__sub">
              Open a safe practice copy with sample specs and take a guided, click-through tour. Nothing you do there is saved.
            </div>
          </div>
          <button type="button" className="help-demo-cta__btn" data-tour="launch-demo" onClick={onLaunchDemo}>
            ▶ Launch demo &amp; tutorial
          </button>
        </div>
      )}
      <div className="help-screen__bar">
        <div className="help-screen__intro">
          <div className="help-screen__title">User Guide</div>
          <div className="help-screen__sub">Everything you need to know about the Lumineo Sign Builder.</div>
        </div>
        <div className="help-screen__actions">
          <a className="help-btn help-btn--secondary" href={GUIDE_URL} target="_blank" rel="noopener noreferrer">
            Open in new tab ↗
          </a>
          <a className="help-btn help-btn--primary" href={`${GUIDE_URL}?print=1`} target="_blank" rel="noopener noreferrer">
            ⬇ Download PDF
          </a>
        </div>
      </div>
      <iframe className="help-screen__frame" src={GUIDE_URL} title="Lumineo Sign Builder — User Guide" loading="lazy" />
    </div>
  );
}
