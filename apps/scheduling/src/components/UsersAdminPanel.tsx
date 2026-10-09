import { useMemo, useState } from "react";
import { TYPE_CONFIG, USER_DIRECTORY, type UserType } from "../services/current-user";
import { useUserDirectoryStore, type DirectoryUser } from "../store/user-directory-store";
import JobEditFieldsDialog from "./JobEditFieldsDialog";
import { RECEIVING_SITES } from "../services/warehouse-sites";

const TYPE_OPTIONS = Object.keys(TYPE_CONFIG) as UserType[];

/**
 * Admin-only "Edit users" screen (opened from Settings). Manages the
 * crfdf_appuser directory: add a login, set its role, or remove it — no deploy
 * needed. Entries still in the hardcoded code list (not yet overridden by a
 * table row) show read-only, with an Override to pull them into the table.
 *
 * "Jobs" per user: Admin / Developer / Ops edit the whole Jobs list by role;
 * anyone else is view only there unless specific fields are granted to them
 * (JobEditFieldsDialog → crfdf_appuser.crfdf_jobeditfields).
 *
 * "Site" per user: where they work — Warehouse Management's Receive defaults
 * its "Received at" to it (crfdf_appuser.crfdf_homesite).
 */
export default function UsersAdminPanel({ onClose }: { onClose: () => void }) {
  const users = useUserDirectoryStore((s) => s.users);
  const addUser = useUserDirectoryStore((s) => s.addUser);
  const updateUser = useUserDirectoryStore((s) => s.updateUser);
  const removeUser = useUserDirectoryStore((s) => s.removeUser);
  const setJobEditFields = useUserDirectoryStore((s) => s.setJobEditFields);
  const [grantFor, setGrantFor] = useState<DirectoryUser | null>(null);

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

  const roleSelect = (value: UserType, onChange: (t: UserType) => void, cls: string) => (
    <select
      className={"form-field__select " + cls}
      value={value}
      onChange={(e) => onChange(e.target.value as UserType)}
    >
      {TYPE_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {TYPE_CONFIG[t].label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Edit users</div>

        <div className="slide-over__body users-admin">
          <p className="users-admin__note">
            <strong>Jobs</strong>: Admin, Developer and Operations edit the whole Jobs list. Everyone else is view
            only there — click their <em>Jobs</em> button to let them edit specific fields.
          </p>
          <p className="users-admin__note">
            <strong>Site</strong>: where the person works. When they receive a PO delivery, &ldquo;Received at&rdquo;
            starts on this site.
          </p>
          <p className="users-admin__note">
            Sets each login&apos;s role. Who can open the app at all is controlled by sharing it
            in Power Apps — this only changes what a signed-in user sees. Any login not listed
            defaults to Admin.
          </p>

          <div className="users-admin__section">
            <div className="users-admin__label">Add a user</div>
            <input
              className="form-field__input users-admin__email"
              placeholder="email@lumineosigns.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAdd();
              }}
            />
            <div className="users-admin__addrow">
              {roleSelect(newType, setNewType, "users-admin__grow")}
              <button className="btn-primary" disabled={!newEmail.trim()} onClick={onAdd}>
                Add
              </button>
            </div>
          </div>

          <div className="users-admin__section">
            <div className="users-admin__label">Users ({sortedUsers.length})</div>
            {sortedUsers.length === 0 && (
              <div className="users-admin__empty">No users in the table yet — add one above.</div>
            )}
            {sortedUsers.map((u) => (
              <div key={u.id} className="users-admin__row">
                <span className="users-admin__row-email" title={u.email}>
                  {u.email}
                </span>
                {TYPE_CONFIG[u.userType]?.editJobs ? (
                  <span className="users-admin__jobs users-admin__jobs--all" title="Edits the whole Jobs list (by role)">
                    Jobs: all
                  </span>
                ) : (
                  <button
                    type="button"
                    className={"users-admin__jobs" + (u.jobEditFields.length ? " users-admin__jobs--some" : "")}
                    title="Choose the Jobs-list fields this person may edit"
                    onClick={() => setGrantFor(u)}
                  >
                    {u.jobEditFields.length ? `Jobs: ${u.jobEditFields.length} field${u.jobEditFields.length === 1 ? "" : "s"}` : "Jobs: view"}
                  </button>
                )}
                <select
                  className="form-field__select users-admin__site"
                  value={u.homeSite}
                  title="Home site — Warehouse receiving defaults to it"
                  aria-label={`Home site for ${u.email}`}
                  onChange={(e) => void updateUser(u.id, { homeSite: e.target.value })}
                >
                  <option value="">Site —</option>
                  {[...RECEIVING_SITES, ...(u.homeSite && !RECEIVING_SITES.includes(u.homeSite) ? [u.homeSite] : [])].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {roleSelect(u.userType, (t) => void updateUser(u.id, { userType: t }), "users-admin__role")}
                <button
                  className="users-admin__remove"
                  title="Remove user"
                  onClick={() => void removeUser(u.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {codeOnly.length > 0 && (
            <div className="users-admin__section">
              <div className="users-admin__label">From code (fallback)</div>
              {codeOnly.map((c) => (
                <div key={c.email} className="users-admin__row users-admin__row--muted">
                  <span className="users-admin__row-email" title={c.email}>
                    {c.email}
                  </span>
                  <span className="users-admin__row-type">{TYPE_CONFIG[c.userType].label}</span>
                  <button
                    className="btn-secondary users-admin__override"
                    title="Make this user editable (copies it into the table)"
                    onClick={() => void addUser(c.email, c.userType)}
                  >
                    Override
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {grantFor && (
          <JobEditFieldsDialog
            email={grantFor.email}
            initial={grantFor.jobEditFields}
            canSeeMoney={!!TYPE_CONFIG[grantFor.userType]?.money}
            onSave={(keys) => void setJobEditFields(grantFor.id, keys)}
            onClose={() => setGrantFor(null)}
          />
        )}

        <div className="users-admin__footer">
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
