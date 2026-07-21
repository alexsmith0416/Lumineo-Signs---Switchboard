import { useState } from "react";
import { type UseScheduleStore, useScheduleStore } from "../store/schedule-store";
import type { ScheduleLine } from "../engine/types";
import { encodeGroup, parseGroup, type GroupMember } from "../services/group-card";
import ConfirmDialog from "./ConfirmDialog";
import GroupCardBody from "./GroupCardBody";

/**
 * View / edit an existing grouped job card (opened by clicking the card's
 * background). Editors can rename it, edit its description, add / remove member
 * jobs, or delete the whole group; view-only users see a read-only list.
 */
export default function GroupPanel({
  line,
  onClose,
  useStore = useScheduleStore,
  readOnly = false,
}: {
  line: ScheduleLine;
  onClose: () => void;
  useStore?: UseScheduleStore;
  readOnly?: boolean;
}) {
  const dataSource = useStore((s) => s.dataSource);
  const loadWeek = useStore((s) => s.loadWeek);
  const deleteScheduleLine = useStore((s) => s.deleteScheduleLine);

  const initial = parseGroup(line) ?? { title: line.customerName, description: "", members: [] };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [members, setMembers] = useState<GroupMember[]>(initial.members);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onSave = async () => {
    setBusy(true);
    try {
      const name = title.trim() || "Group";
      await dataSource.updateScheduleLine(line.id, {
        jobNo: name,
        customerName: name,
        planningLineDescription: encodeGroup({
          title: name,
          description: description.trim(),
          members,
        }),
      });
      await loadWeek();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteScheduleLine(line.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="slide-over" onClick={onClose}>
        <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
          <div className="section-title">
            {readOnly ? "Group card" : "Edit group card"}
            {readOnly && (
              <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--text-tertiary)" }}>
                · View only
              </span>
            )}
          </div>

          <div className="slide-over__body">
            <GroupCardBody
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              members={members}
              onAddMember={(m) => setMembers((prev) => [...prev, m])}
              onRemoveMember={(id) => setMembers((prev) => prev.filter((x) => x.id !== id))}
              readOnly={readOnly}
              useStore={useStore}
            />
          </div>

          <div
            style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}
          >
            {readOnly ? (
              <>
                <div style={{ flex: 1 }} />
                <button className="btn-primary" onClick={onClose}>
                  Close
                </button>
              </>
            ) : (
              <>
                <button className="btn-danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
                <div style={{ flex: 1 }} />
                <button className="btn-secondary" disabled={busy} onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy || !title.trim()} onClick={onSave}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this group card?"
          message="Remove the group card and its job list from the board? This can't be undone."
          confirmLabel="Yes"
          cancelLabel="Cancel"
          danger
          busy={busy}
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}
