/**
 * Thin banner shown while the demo sandbox is active (same as Switchboard's).
 */
import { useDemoStore } from "../store/demo-store";

export default function DemoBanner() {
  const demoMode = useDemoStore((s) => s.demoMode);
  const locked = useDemoStore((s) => s.locked);
  const exitDemo = useDemoStore((s) => s.exitDemo);
  const openWelcome = useDemoStore((s) => s.openWelcome);

  if (!demoMode) return null;

  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner__dot" aria-hidden="true" />
      <strong className="demo-banner__label">Demo sandbox</strong>
      <span className="demo-banner__msg">You're exploring a safe copy with sample specs — changes here are not saved.</span>
      <div className="demo-banner__actions">
        <button type="button" className="demo-banner__btn" onClick={openWelcome}>
          ▶ Tutorial
        </button>
        {!locked && (
          <button type="button" className="demo-banner__btn demo-banner__btn--exit" onClick={() => void exitDemo()}>
            Exit demo
          </button>
        )}
      </div>
    </div>
  );
}
