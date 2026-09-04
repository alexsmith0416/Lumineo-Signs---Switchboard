import { useEffect, useMemo, useState } from "react";
import type { Department } from "../engine/types";
import { newId, type QueueGroup, type QueueItem } from "../services/job-queue-data";
import type { UseJobQueueStore } from "../store/job-queue-store";
import type { UseScheduleStore } from "../store/schedule-store";
import type { ScheduleLine } from "../engine/types";
import AddJobPanel from "./AddJobPanel";
import JobTaskPicker from "./JobTaskPicker";
import { QueueEditIcon, QueueToggleIcon } from "./QueueIcons";
import QueueGroupDialog from "./QueueGroupDialog";

/** Build a queue item from the draft the unified Add panel produces. */
function queueItemFromDraft(draft: ScheduleLine, group: QueueGroup): QueueItem {
  return {
    id: newId(),
    groupId: group.id,
    jobNo: draft.jobNo,
    customerName: draft.customerName,
    jobDescription: draft.jobDescription ?? "",
    planningLineDescription: draft.planningLineDescription,
    estimatedHours: draft.estimatedHours,
    departmentId: draft.departmentId ?? "",
    crewPersons: draft.crewPersons ?? null,
    crewTrucks: draft.crewTrucks ?? null,
    crewTrips: draft.crewTrips ?? null,
    installZip: draft.installZip ?? null,
    invoiceAmount: draft.invoiceAmount ?? null,
    isCustom: false,
    customColor: null,
    customTextColor: null,
    sortOrder: group.items.length,
  };
}

// Drag payload keys. queueItemId is ALSO read by the calendar's day cells so a
// card can be dragged straight from the queue onto the schedule.
export const DND_QUEUE_ITEM = "text/queueitemid";
const DND_QUEUE_GROUP = "text/queuegroupid";
// Calendar card → dropped into a group. NOTE: the HTML5 drag store lowercases
// all type keys, so `dataTransfer.types` reports "text/lineid" — this MUST be
// lowercase or the group's drop-target check never matches. (getData is
// case-insensitive, so reads work either way.)
const DND_LINE = "text/lineid";


interface JobQueuePanelProps {
  useQueueStore: UseJobQueueStore;
  /** The board's schedule store — powers the shared Add Job panel (job search,
   *  task band by kind). */
  scheduleStore: UseScheduleStore;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  departments: Department[];
  /** A calendar job card was dropped into a group — store it + remove the line. */
  onCalendarCardDrop: (lineId: string, groupId: string) => void;
}

export default function JobQueuePanel({
  useQueueStore,
  scheduleStore,
  open,
  onClose,
  canEdit,
  departments,
  onCalendarCardDrop,
}: JobQueuePanelProps) {
  const groups = useQueueStore((s) => s.groups);
  const load = useQueueStore((s) => s.load);
  const addGroup = useQueueStore((s) => s.addGroup);
  const updateGroup = useQueueStore((s) => s.updateGroup);
  const deleteGroup = useQueueStore((s) => s.deleteGroup);
  const toggleCollapsed = useQueueStore((s) => s.toggleCollapsed);
  const reorderGroups = useQueueStore((s) => s.reorderGroups);
  const addItem = useQueueStore((s) => s.addItem);
  const updateItem = useQueueStore((s) => s.updateItem);
  const removeItem = useQueueStore((s) => s.removeItem);
  const moveItem = useQueueStore((s) => s.moveItem);
  const kind = useQueueStore((s) => s.kind);

  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; group: QueueGroup } | null>(null);
  const [editItem, setEditItem] = useState<QueueItem | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [groupDragId, setGroupDragId] = useState<string | null>(null);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const onGroupHeaderDrop = (targetId: string) => {
    if (!groupDragId || groupDragId === targetId) return;
    const ids = groups.map((g) => g.id);
    const from = ids.indexOf(groupDragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    reorderGroups(ids);
    setGroupDragId(null);
  };

  return (
    <>
      <aside className={"job-queue" + (open ? " job-queue--open" : "")} aria-hidden={!open}>
        <div className="job-queue__head">
          <span className="job-queue__title">Job Queue</span>
          <div className="job-queue__head-actions">
            {canEdit && (
              <button
                type="button"
                className={"job-queue__icon-btn" + (editing ? " job-queue__icon-btn--on" : "")}
                title={editing ? "Done editing" : "Edit groups"}
                aria-pressed={editing}
                onClick={() => setEditing((v) => !v)}
              >
                <QueueEditIcon size={16} />
              </button>
            )}
            <button type="button" className="job-queue__icon-btn" title="Close Job Queue" onClick={onClose}>
              <QueueToggleIcon size={18} />
            </button>
          </div>
        </div>

        <div className="job-queue__body">
          {groups.length === 0 && (
            <div className="job-queue__empty-all">
              No groups yet.
              {canEdit && " Use the edit button to add one."}
            </div>
          )}

          {groups.map((group) => (
            <GroupBlock
              key={group.id}
              group={group}
              deptMap={deptMap}
              editing={editing}
              canEdit={canEdit}
              adding={addingTo === group.id}
              onToggleAdding={() => setAddingTo((cur) => (cur === group.id ? null : group.id))}
              onToggleCollapsed={() => toggleCollapsed(group.id)}
              onEditGroup={() => setDialog({ mode: "edit", group })}
              onDeleteGroup={() => deleteGroup(group.id)}
              onOpenItem={setEditItem}
              onRemoveItem={removeItem}
              onMoveItem={moveItem}
              onCalendarCardDrop={onCalendarCardDrop}
              groupDragId={groupDragId}
              onGroupDragStart={() => setGroupDragId(group.id)}
              onGroupDragEnd={() => setGroupDragId(null)}
              onGroupHeaderDrop={() => onGroupHeaderDrop(group.id)}
            />
          ))}

          {editing && canEdit && (
            <button type="button" className="job-queue__add-group" onClick={() => setDialog({ mode: "add" })}>
              + Add Group
            </button>
          )}
        </div>
      </aside>

      {dialog && (
        <QueueGroupDialog
          initial={dialog.mode === "edit" ? dialog.group : undefined}
          onCancel={() => setDialog(null)}
          onSave={(vals) => {
            if (dialog.mode === "edit") updateGroup(dialog.group.id, vals);
            else addGroup(vals);
            setDialog(null);
          }}
        />
      )}

      {editItem && (
        <QueueItemEditPanel
          item={editItem}
          isInstall={kind !== "production"}
          onClose={() => setEditItem(null)}
          onSave={(changes) => {
            updateItem(editItem.id, changes);
            setEditItem(null);
          }}
          onDelete={() => {
            removeItem(editItem.id);
            setEditItem(null);
          }}
        />
      )}
      {addingTo &&
        (() => {
          const group = groups.find((g) => g.id === addingTo);
          if (!group) return null;
          // Reuse the SAME Add Job panel the board uses (search + Single/Multi/
          // Custom task). Its draft becomes a queue item instead of a card.
          return (
            <AddJobPanel
              useStore={scheduleStore}
              bcOnly
              confirmLabel="Add to queue"
              onConfigure={(draft) => {
                addItem(queueItemFromDraft(draft, group));
                setAddingTo(null);
              }}
              onClose={() => setAddingTo(null)}
            />
          );
        })()}
    </>
  );
}

// --- One group -------------------------------------------------------------
interface GroupBlockProps {
  group: QueueGroup;
  deptMap: Map<string, Department>;
  editing: boolean;
  canEdit: boolean;
  adding: boolean;
  onToggleAdding: () => void;
  onToggleCollapsed: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onOpenItem: (item: QueueItem) => void;
  onRemoveItem: (id: string) => void;
  onMoveItem: (itemId: string, toGroupId: string, toIndex: number) => void;
  onCalendarCardDrop: (lineId: string, groupId: string) => void;
  groupDragId: string | null;
  onGroupDragStart: () => void;
  onGroupDragEnd: () => void;
  onGroupHeaderDrop: () => void;
}

function GroupBlock({
  group,
  deptMap,
  editing,
  canEdit,
  adding,
  onToggleAdding,
  onToggleCollapsed,
  onEditGroup,
  onDeleteGroup,
  onOpenItem,
  onRemoveItem,
  onMoveItem,
  onCalendarCardDrop,
  groupDragId,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupHeaderDrop,
}: GroupBlockProps) {
  const [dropActive, setDropActive] = useState(false);
  const totalHours = group.items.reduce((sum, it) => sum + (it.estimatedHours || 0), 0);

  const acceptDrop = (e: React.DragEvent, index: number) => {
    const itemId = e.dataTransfer.getData(DND_QUEUE_ITEM);
    const lineId = e.dataTransfer.getData(DND_LINE);
    if (itemId) {
      onMoveItem(itemId, group.id, index);
    } else if (lineId) {
      onCalendarCardDrop(lineId, group.id);
    }
  };

  const canDropHere = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(DND_QUEUE_ITEM) || e.dataTransfer.types.includes(DND_LINE);

  return (
    <div className="jq-group">
      <div
        className={"jq-group__head" + (groupDragId === group.id ? " jq-group__head--dragging" : "")}
        style={{ background: group.color, color: group.textColor }}
        draggable={editing && canEdit}
        onDragStart={editing && canEdit ? onGroupDragStart : undefined}
        onDragEnd={editing && canEdit ? onGroupDragEnd : undefined}
        onDragOver={editing && canEdit && groupDragId ? (e) => e.preventDefault() : undefined}
        onDrop={editing && canEdit && groupDragId ? onGroupHeaderDrop : undefined}
      >
        <button
          type="button"
          className="jq-group__caret"
          style={{ color: group.textColor }}
          onClick={onToggleCollapsed}
          aria-label={group.collapsed ? "Expand" : "Collapse"}
        >
          {group.collapsed ? "▸" : "▾"}
        </button>
        <span className="jq-group__name">{group.name}</span>
        <span className="jq-group__meta" style={{ color: group.textColor }}>
          {group.items.length}
          {totalHours > 0 && ` · ${totalHours}h`}
        </span>
        {editing && canEdit && (
          <span className="jq-group__edit-actions">
            <button type="button" title="Edit group" onClick={onEditGroup} style={{ color: group.textColor }}>
              <QueueEditIcon size={13} />
            </button>
            <button type="button" title="Delete group" onClick={onDeleteGroup} style={{ color: group.textColor }}>
              ✕
            </button>
            <span className="jq-group__grip" title="Drag to reorder">⠿</span>
          </span>
        )}
      </div>

      {!group.collapsed && (
        <div
          className={"jq-group__body" + (dropActive ? " jq-group__body--drop" : "")}
          onDragOver={(e) => {
            if (!canDropHere(e)) return;
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
          }}
          onDrop={(e) => {
            if (!canDropHere(e)) return;
            e.preventDefault();
            setDropActive(false);
            acceptDrop(e, group.items.length);
          }}
        >
          {group.items.length === 0 && <div className="jq-group__empty">Empty — drag jobs here or add one.</div>}

          {group.items.map((item, i) => (
            <QueueCard
              key={item.id}
              item={item}
              dept={deptMap.get(item.departmentId)}
              canEdit={canEdit}
              onOpen={() => onOpenItem(item)}
              onRemove={() => onRemoveItem(item.id)}
              onDropBefore={(e) => {
                if (!canDropHere(e)) return;
                e.preventDefault();
                e.stopPropagation();
                setDropActive(false);
                acceptDrop(e, i);
              }}
            />
          ))}


          {canEdit && (
            <button type="button" className="jq-add-job-btn" onClick={onToggleAdding}>
              {adding ? "Close" : "+ Add Job"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- One queue card --------------------------------------------------------
function QueueCard({
  item,
  dept,
  canEdit,
  onOpen,
  onRemove,
  onDropBefore,
}: {
  item: QueueItem;
  dept: Department | undefined;
  canEdit: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onDropBefore: (e: React.DragEvent) => void;
}) {
  const stripe = item.isCustom && item.customColor ? item.customColor : dept?.color ?? "#c9ced8";
  return (
    <div
      className={"jq-card" + (canEdit ? " jq-card--clickable" : "")}
      style={{ borderLeftColor: stripe }}
      draggable={canEdit}
      onClick={canEdit ? onOpen : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_QUEUE_ITEM, item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_QUEUE_ITEM) || e.dataTransfer.types.includes(DND_LINE)) {
          e.preventDefault();
        }
      }}
      onDrop={onDropBefore}
      title={canEdit ? "Click to edit · drag onto the schedule or another group" : undefined}
    >
      <div className="jq-card__main">
        <div className="jq-card__top">
          {item.jobNo && <span className="jq-card__jobno">{item.jobNo}</span>}
          <span className="jq-card__cust">{item.customerName || "—"}</span>
        </div>
        {item.jobDescription && <div className="jq-card__jobdesc">{item.jobDescription}</div>}
        {item.planningLineDescription && <div className="jq-card__desc">{item.planningLineDescription}</div>}
      </div>
      <div className="jq-card__side">
        {item.estimatedHours > 0 && <span className="jq-card__hours">{item.estimatedHours}h</span>}
        {canEdit && (
          <button
            type="button"
            className="jq-card__remove"
            title="Remove from queue"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// --- Edit a parked job (click a queue card) --------------------------------
// Mirrors the scheduler's Edit Job panel, minus placement (no employee / start /
// end / cascade) — a queue item isn't on the board yet. Writes back via updateItem.
function QueueItemEditPanel({
  item,
  isInstall,
  onClose,
  onSave,
  onDelete,
}: {
  item: QueueItem;
  isInstall: boolean;
  onClose: () => void;
  onSave: (changes: Partial<QueueItem>) => void;
  onDelete: () => void;
}) {
  const [customerName, setCustomerName] = useState(item.customerName);
  const [jobDescription, setJobDescription] = useState(item.jobDescription);
  const [taskDescription, setTaskDescription] = useState(item.planningLineDescription);
  const [hours, setHours] = useState(String(item.estimatedHours));
  const [crewTrips, setCrewTrips] = useState(item.crewTrips == null ? "" : String(item.crewTrips));
  const [crewPersons, setCrewPersons] = useState(item.crewPersons == null ? "" : String(item.crewPersons));
  const [crewTrucks, setCrewTrucks] = useState(item.crewTrucks == null ? "" : String(item.crewTrucks));
  const [installZip, setInstallZip] = useState(item.installZip ?? "");

  const numOrNull = (v: string): number | null => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  };

  const save = () => {
    const h = Number(hours);
    onSave({
      customerName: customerName.trim(),
      jobDescription: jobDescription,
      planningLineDescription: taskDescription,
      estimatedHours: Number.isNaN(h) || h <= 0 ? item.estimatedHours : h,
      crewTrips: numOrNull(crewTrips),
      crewPersons: numOrNull(crewPersons),
      crewTrucks: numOrNull(crewTrucks),
      installZip: installZip.trim() || null,
    });
  };

  return (
    // Above the Job Queue panel (z-index 250) so the editor isn't hidden behind it.
    <div className="slide-over" style={{ zIndex: 300 }} onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          {item.jobNo ? `${item.jobNo} · ` : ""}
          {item.customerName || "Queued job"}
          <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--text-tertiary)" }}>· In queue</span>
        </div>

        <div className="form-field">
          <div className="form-field__label">Customer</div>
          <input
            className="form-field__input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Job description</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={jobDescription}
            placeholder="BC job summary (shown under the job name)"
            onChange={(e) => setJobDescription(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        {item.jobNo && !item.isCustom && (
          <div className="form-field">
            <div className="form-field__label">Job tasks (from BC)</div>
            <JobTaskPicker
              jobNo={item.jobNo}
              kind={isInstall ? "installation" : "production"}
              currentDescriptions={taskDescription.split("\n")}
              onChange={(descriptions, totalHours) => {
                setTaskDescription(descriptions.join("\n"));
                setHours(String(totalHours || item.estimatedHours));
              }}
            />
          </div>
        )}
        <div className="form-field">
          <div className="form-field__label">Task / card text</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={taskDescription}
            placeholder="Task description shown on the card"
            onChange={(e) => setTaskDescription(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Estimated hours</div>
          <input
            className="form-field__input"
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>

        {isInstall && (
          <>
            <div className="form-field">
              <div className="form-field__label">Trips · crew per trip</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <input className="form-field__input" type="number" min="0" step="1" value={crewTrips} placeholder="Trips" title="Number of trips" onChange={(e) => setCrewTrips(e.target.value)} />
                <input className="form-field__input" type="number" min="0" step="1" value={crewPersons} placeholder="Men" title="Men per trip" onChange={(e) => setCrewPersons(e.target.value)} />
                <input className="form-field__input" type="number" min="0" step="1" value={crewTrucks} placeholder="Trucks" title="Trucks per trip" onChange={(e) => setCrewTrucks(e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <div className="form-field__label">Install ZIP (weather)</div>
              <input
                className="form-field__input"
                value={installZip}
                placeholder="e.g. 67501"
                onChange={(e) => setInstallZip(e.target.value)}
              />
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn-danger" onClick={onDelete}>
            Remove
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
