/**
 * Help screen — embeds the brand user guide (served from /public/USER-GUIDE.html)
 * with quick actions to download it as a PDF or open it full-screen in a new tab.
 * The guide is a self-contained HTML doc, so it always matches the shipped app.
 */
const GUIDE_URL = `${import.meta.env.BASE_URL}USER-GUIDE.html`;

export default function HelpScreen() {
  return (
    <div className="help-screen">
      <div className="help-screen__bar">
        <div className="help-screen__intro">
          <div className="help-screen__title">User Guide</div>
          <div className="help-screen__sub">
            Everything you need to know about the Lumineo Project Scheduler.
          </div>
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
      <iframe
        className="help-screen__frame"
        src={GUIDE_URL}
        title="Lumineo Project Scheduler — User Guide"
        loading="lazy"
      />
    </div>
  );
}
