import type { AppTile, Role, User } from "../types";

interface Props {
  tiles: AppTile[];
  role: Role;
  user: User;
}

// Build the final launch URL by appending ?userEmail=&role= per the
// docs/07-sub-apps.md launch contract. Sub-apps run under HashRouter so
// the query string belongs AFTER the hash — otherwise useLocation().search
// returns an empty string and the launch params hook falls back to
// defaults.
function buildLaunchUrl(base: string, params: URLSearchParams): string {
  // No hash anywhere → land on `/` and add the params there.
  if (!base.includes("#")) {
    return `${base}#/?${params.toString()}`;
  }
  // Already has a hash. Preserve the path segment and merge into any
  // existing post-hash query string so deep-link params (e.g. specId)
  // survive.
  const hashIdx = base.indexOf("#");
  const pre = base.slice(0, hashIdx);
  const hash = base.slice(hashIdx + 1);
  const qIdx = hash.indexOf("?");
  const hashPath = qIdx === -1 ? hash : hash.slice(0, qIdx);
  const hashSearch = qIdx === -1 ? "" : hash.slice(qIdx + 1);
  const merged = new URLSearchParams(hashSearch);
  for (const [k, v] of params.entries()) merged.set(k, v);
  return `${pre}#${hashPath}?${merged.toString()}`;
}

export default function AppLauncher({ tiles, role, user }: Props) {
  const visible = tiles.filter((t) => t.audience.includes(role));

  function launch(tile: AppTile) {
    if (!tile.enabled || !tile.launchUrl) return;
    const params = new URLSearchParams({ userEmail: user.email, role });
    window.location.href = buildLaunchUrl(tile.launchUrl, params);
  }

  return (
    <>
      <div className="section-label">Apps</div>
      <div className="applauncher">
        {visible.map((t) => {
          const isLaunchable = t.enabled && !!t.launchUrl;
          return (
            <button
              key={t.key}
              type="button"
              className={`apptile ${!isLaunchable ? "is-disabled" : ""}`}
              disabled={!isLaunchable}
              onClick={() => launch(t)}
              title={
                isLaunchable
                  ? `Launch ${t.label} as ${user.name}`
                  : `${t.label} — coming soon`
              }
            >
              <span className="apptile__emoji" aria-hidden="true">
                {t.emoji}
              </span>
              <span className="apptile__label">{t.label}</span>
              {t.badgeText && <span className="apptile__badge">{t.badgeText}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
