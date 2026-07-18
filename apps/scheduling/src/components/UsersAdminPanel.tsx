import { useMemo, useState } from "react";
import { TYPE_CONFIG, USER_DIRECTORY, type UserType } from "../services/current-user";
import { useUserDirectoryStore } from "../store/user-directory-store";

const TYPE_OPTIONS = Object.keys(TYPE_CONFIG) as UserType[];

/**
 * Admin-only "Edit users" screen (opened from the top-right user menu). Manages
 * the crfdf_appuser directory: add a login, set its role, or remove it — no
 * deploy needed. Entries still in the hardcoded code list (not yet overridden by
 * a table row) show read-only, with an Override to pull them into the table.
 */
export default function UsersAdminPanel({ onClose }: { onClose: () => void }) {
  const users = useUserDirectoryStore((s) => s.users);
  const addUser = useUserDirectoryStore((s) => s.addUser);
  const updateUser = useUserDirectoryStore((s) => s.updateUser);
  const removeUser = useUserDirectoryStore((s) => s.removeUser);

  const [newEmail, setNewEmail] = useState("");
  const [newType, setNewType] = useState<UserType>("production");

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users],
  );

  const tableEmails = useMemo(() => new Set(users.map((u) => u.email)), [users]);
  const codeOnly = useMemo(
    () =>
      Object.entries(USER_DIRECTORY)
        .map(([email, type]) => ({ email: email.toLowerCase(), userType: type as UserType }))
        .filter((c) => !tableEmails.has(c.email))
        .sort((a, b) => a.email.localeCompare(b.email)),
    [tableEmails],
  );

  const onAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    void addUser(email, newType);
    setNewEmail("");
    setNewType("production");
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Edit users</div>
        <div style={{ padding: "0 12px 8px", fontSize: 11, color: "var(--text-secondary)" }}>
          Sets each login&apos;s role. Who can open the app at all is controlled by
          sharing it in Power Apps — this only changes what a signed-in user sees.
          Any login not listed defaults to Admin.
        </div>

        <div
          className="slide-over__body"
          style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div className="form-field">
            <div className="form-field__label">Add a user</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="form-field__input"
                style={{ flex: 1 }}
                placeholder="email@lumineosigns.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAdd();
                }}
              />
              <select
                className="form-field__select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as UserType)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_CONFIG[t].label}
                  </option>
                ))}
              </select>
              <button className="btn-primary" disabled={!newEmail.trim()} onClick={onAdd}>
                Add
              </button>
            </div>
          </div>

          <div className="form-field__label">Users ({sortedUsers.length})</div>
          {sortedUsers.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              No users in the table yet — add one above.
            </div>
          )}
          {sortedUsers.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={u.email}
              >
                {u.email}
              </span>
              <select
                className="form-field__select"
                value={u.userType}
                onChange={(e) => void updateUser(u.id, { userType: e.target.value as UserType })}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_CONFIG[t].label}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary"
                title="Remove user"
                onClick={() => void removeUser(u.id)}
                style={{ padding: "0 10px" }}
              >
                ✕
              </button>
            </div>
          ))}

          {codeOnly.length > 0 && (
            <>
              <div className="form-field__label" style={{ marginTop: 6 }}>
                From code (fallback)
              </div>
              {codeOnly.map((c) => (
                <div
                  key={c.email}
                  style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.75 }}
                >
                  <span style={{ flex: 1, fontSize: 12 }} title={c.email}>
                    {c.email}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {TYPE_CONFIG[c.userType].label}
                  </span>
                  <button
                    className="btn-secondary"
                    title="Make this user editable (copies it into the table)"
                    onClick={() => void addUser(c.email, c.userType)}
                    style={{ padding: "0 10px" }}
                  >
                    Override
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div
          style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}
        >
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
