import { useEffect, useState } from "react";
import { useJobGeoStore } from "../../store/job-geo-store";
import { testOrsKey, type OrsCheck } from "../../services/ors-test";

/**
 * Settings → Install Planner. The openrouteservice key the planner uses to put
 * each job's pin at its street address (free sign-up at openrouteservice.org).
 * Stored in the app settings (crfdf_jobsviews), so it's readable by app users
 * — fine for a free, rate-limited key. Admin / Developer / Ops (caller gates).
 */
export default function PlannerSettingsSection() {
  const saved = useJobGeoStore((s) => s.orsKey);
  const loaded = useJobGeoStore((s) => s.loaded);
  const err = useJobGeoStore((s) => s.lookupError);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<OrsCheck[] | null>(null);
  const test = async () => {
    setTesting(true);
    setChecks(null);
    const r = await testOrsKey(draft.trim());
    setChecks(r);
    setTesting(false);
    // It works now (key fixed / policy saved): let the planner carry on.
    if (r.every((c) => c.ok) && draft.trim() === saved) useJobGeoStore.getState().retry();
  };
  useEffect(() => {
    void useJobGeoStore.getState().load();
  }, []);
  useEffect(() => setDraft(saved), [saved]);

  const save = async () => {
    setState("saving");
    try {
      await useJobGeoStore.getState().setOrsKey(draft);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section__title">Install Planner</div>
      <div className="settings-row">
        <div className="settings-row__text">
          <div className="settings-row__title">openrouteservice key</div>
          <div className="settings-row__desc">
            Places each job's pin at its street address (instead of its ZIP's center) and, later, real drive times.
            Free at <strong>openrouteservice.org</strong> → sign up → <em>Dashboard</em> → <em>Tokens</em>. The app's content
            security policy must allow <code>https://api.openrouteservice.org</code> (connect-src).
            {err && <div className="settings-row__status">{err}</div>}
          </div>
        </div>
        <div className="pl-key">
          <input
            className="form-field__input"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder={loaded ? "Paste the key" : "Loading…"}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setState("idle");
            }}
            aria-label="openrouteservice key"
          />
          <button type="button" className="btn-primary" disabled={!loaded || draft.trim() === saved || state === "saving"} onClick={() => void save()}>
            {state === "saving" ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn-secondary" disabled={!draft.trim() || testing} onClick={() => void test()}>
            {testing ? "Testing…" : "Test"}
          </button>
          {state === "saved" && <span className="pl-key__ok">Saved</span>}
          {state === "error" && <span className="pl-key__err">Couldn't save</span>}
          {checks && (
            <ul className="pl-key__checks">
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? "pl-key__ok" : "pl-key__err"}>
                  {c.ok ? "✓" : "✗"} {c.label}: {c.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
