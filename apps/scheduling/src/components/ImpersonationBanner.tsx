import { TYPE_CONFIG, useCurrentUser } from "../services/current-user";
import { useImpersonationStore } from "../store/impersonation-store";

/**
 * Persistent bar shown while an admin is previewing the app as another user, so
 * it's always obvious you're not looking at your own view. "Exit" returns to
 * the real admin identity.
 */
export default function ImpersonationBanner() {
  const { isImpersonating, viewingAsName, type } = useCurrentUser();
  const clear = useImpersonationStore((s) => s.clear);
  if (!isImpersonating) return null;
  return (
    <div className="impersonation-banner" role="status">
      <span>
        👁 Viewing as <strong>{viewingAsName}</strong> · {TYPE_CONFIG[type].label} — you're
        seeing exactly what they see.
      </span>
      <button type="button" onClick={clear}>
        Exit view-as
      </button>
    </div>
  );
}
