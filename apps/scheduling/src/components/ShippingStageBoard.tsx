import { useEffect, useState } from "react";
import type { QueueGroup, QueueItem } from "../services/job-queue-data";
import { useShippingQueueStore } from "../store/job-queue-store";
import {
  DND_SHIP_STAGE,
  reorderGroupIds,
  stageItemFromJob,
  stageItemFromManual,
  stagedCount,
} from "../shipping/stage";
import JobSearch from "./JobSearch";
import QueueGroupDialog from "./QueueGroupDialog";
import { QueueEditIcon } from "./QueueIcons";

/**
 * The Shipping board's staging kanban — always on screen below the week's day
 * columns. Lists are user-named and color-coded (the same model as the
 * calendars' Job Queue), hold projects that are built and waiting for a truck,
 * and are a MASTER board: not week-scoped, so paging the weeks above leaves it
 * untouched.
 *
 * A card leaves the board by being dragged onto a day (new load) or onto an
 * existing load — `ShippingBoard` owns those drop targets, because it owns the
 * loads store and the editor panel.
 */
interface ShippingStageBoardProps {
  /** View-only: no dragging, no add/edit/remove. */
  readOnly?: boolean;
}

export default function ShippingStageBoard({ readOnly = false }: ShippingStageBoardProps) {
  const groups = useShippingQueueStore((s) => s.groups);
  const loading = useShippingQueueStore((s) => s.loading);
  const loaded = useShippingQueueStore((s) => s.loaded);
  const error = useShippingQueueStore((s) => s.error);
  const load = useShippingQueueStore((s) => s.load);
  const addGroup = useShippingQueueStore((s) => s.addGroup);
  const updateGroup = useShippingQueueStore((s) => s.updateGroup);
  const deleteGroup = useShippingQueueStore((s) => s.deleteGroup);
  const toggleCollapsed = useShippingQueueStore((s) => s.toggleCollapsed);
  const reorderGroups = useShippingQueueStore((s) => s.reorderGroups);
  const addItem = useShippingQueueStore((s) => s.addItem);
  const updateItem = useShippingQueueStore((s) => s.updateItem);
  const removeItem = useShippingQueueStore((s) => s.removeItem);
  const moveItem = useShippingQueueStore((s) => s.moveItem);

  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; group: QueueGroup } | null>(
    null,
  );
  const [editCard, setEditCard] = useState<QueueItem | null>(null);
  const [groupDragId, setGroupDragId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QueueGroup | null>(null);

  // Unlike the calendar queues (which load when their panel opens) this board is
  // always visible, so it loads with the Shipping screen.
  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = !readOnly;

  const onGroupHeaderDrop = (targetId: string) => {
    if (!groupDragId) return;
    const ids = groups.map((g) => g.id);
    const next = reorderGroupIds(ids, groupDragId, targetId);
    if (next !== ids) reorderGroups(next);
    setGroupDragId(null);
  };

  return (
    <div className="ship-stage">
      <div className="ship-stage__head">
        <span className="ship-stage__title">Staging</span>
        <span className="ship-stage__count">{stagedCount(groups)}</span>
        <span className="ship-stage__sub">
          Projects ready to ship — drag one onto a day or a load
        </span>
        <span style={{ flex: 1 }} />
        {canEdit && (
          <button
            type="button"
            className={"ship-stage__icon-btn" + (editing ? " ship-stage__icon-btn--on" : "")}
            title={editing ? "Done editing lists" : "Add, rename, recolor or reorder lists"}
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
          >
            <QueueEditIcon size={16} />
          </button>
        )}
      </div>

      {error && <div className="ship-stage__error">Couldn&rsquo;t load the staging board — {error}</div>}

      <div className="ship-stage__cols">
        {groups.map((group) => (
          <StageColumn
            key={group.id}
            group={group}
            editing={editing}
            canEdit={canEdit}
            onToggleCollapsed={() => toggleCollapsed(group.id)}
            onEditGroup={() => setDialog({ mode: "edit", group })}
            onDeleteGroup={() => setConfirmDelete(group)}
            onAddItem={addItem}
            onOpenCard={setEditCard}
            onRemoveCard={removeItem}
            onMoveCard={moveItem}
            dragging={groupDragId === group.id}
            groupDragActive={groupDragId != null}
            onGroupDragStart={() => setGroupDragId(group.id)}
            onGroupDragEnd={() => setGroupDragId(null)}
            onGroupHeaderDrop={() => onGroupHeaderDrop(group.id)}
          />
        ))}

        {loading && !loaded && <div className="ship-stage__empty-all">Loading…</div>}
        {groups.length === 0 && !loading && loaded && (
          <div className="ship-stage__empty-all">
            No lists yet.
            {canEdit && " Use the pencil, then + Add list, to make one."}
          </div>
        )}

        {editing && canEdit && (
          <button
            type="button"
            className="ship-stage__add-col"
            onClick={() => setDialog({ mode: "add" })}
          >
            + Add list
          </button>
        )}
      </div>

      {dialog && (
        <QueueGroupDialog
          noun="list"
          placeholder="e.g. Ready to Ship, Dodge City, Will Call"
          initial={dialog.mode === "edit" ? dialog.group : undefined}
          onCancel={() => setDialog(null)}
          onSave={(vals) => {
            if (dialog.mode === "edit") updateGroup(dialog.group.id, vals);
            else addGroup(vals);
            setDialog(null);
          }}
        />
      )}

      {confirmDelete && (
        <div className="modal-scrim" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-card__title">Delete &ldquo;{confirmDelete.name}&rdquo;?</div>
            <div className="modal-card__body">
              {confirmDelete.items.length > 0
                ? `This also removes the ${confirmDelete.items.length} staged project${
                    confirmDelete.items.length === 1 ? "" : "s"
                  } in it. Loads you've already built are not affected.`
                : "The list is empty, so nothing else is removed."}
            </div>
            <div className="modal-card__actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  deleteGroup(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                Delete list
              </button>
            </div>
          </div>
        </div>
      )}

      {editCard && (
        <StageCardDialog
          item={editCard}
          onCancel={() => setEditCard(null)}
          onSave={(changes) => {
            updateItem(editCard.id, changes);
            setEditCard(null);
          }}
          onRemove={() => {
            removeItem(editCard.id);
            setEditCard(null);
          }}
        />
      )}
    </div>
  );
}

// --- One list --------------------------------------------------------------
interface StageColumnProps {
  group: QueueGroup;
  editing: boolean;
  canEdit: boolean;
  onToggleCollapsed: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onAddItem: (item: QueueItem) => void;
  onOpenCard: (item: QueueItem) => void;
  onRemoveCard: (id: string) => void;
  onMoveCard: (itemId: string, toGroupId: string, toIndex: number) => void;
  dragging: boolean;
  groupDragActive: boolean;
  onGroupDragStart: () => void;
  onGroupDragEnd: () => void;
  onGroupHeaderDrop: () => void;
}

function StageColumn({
  group,
  editing,
  canEdit,
  onToggleCollapsed,
  onEditGroup,
  onDeleteGroup,
  onAddItem,
  onOpenCard,
  onRemoveCard,
  onMoveCard,
  dragging,
  groupDragActive,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupHeaderDrop,
}: StageColumnProps) {
  const [dropActive, setDropActive] = useState(false);
  const [adding, setAdding] = useState(false);

  const canDropHere = (e: React.DragEvent) => e.dataTransfer.types.includes(DND_SHIP_STAGE);

  const acceptDrop = (e: React.DragEvent, index: number) => {
    const itemId = e.dataTransfer.getData(DND_SHIP_STAGE);
    if (itemId) onMoveCard(itemId, group.id, index);
  };

  const headerDraggable = editing && canEdit;

  return (
    <div className={"stage-col" + (group.collapsed ? " stage-col--collapsed" : "")}>
      <div
        className={"stage-col__head" + (dragging ? " stage-col__head--dragging" : "")}
        style={{ background: group.color, color: group.textColor }}
        draggable={headerDraggable}
        onDragStart={headerDraggable ? onGroupDragStart : undefined}
        onDragEnd={headerDraggable ? onGroupDragEnd : undefined}
        onDragOver={headerDraggable && groupDragActive ? (e) => e.preventDefault() : undefined}
        onDrop={headerDraggable && groupDragActive ? onGroupHeaderDrop : undefined}
      >
        <button
          type="button"
          className="jq-group__caret"
          style={{ color: group.textColor }}
          onClick={onToggleCollapsed}
          aria-label={group.collapsed ? "Expand list" : "Collapse list"}
        >
          {group.collapsed ? "▸" : "▾"}
        </button>
        <span className="jq-group__name">{group.name}</span>
        <span className="jq-group__meta" style={{ color: group.textColor }}>
          {group.items.length}
        </span>
        {editing && canEdit && (
          <span className="jq-group__edit-actions">
            <button
              type="button"
              title="Rename / recolor"
              onClick={onEditGroup}
              style={{ color: group.textColor }}
            >
              <QueueEditIcon size={13} />
            </button>
            <button
              type="button"
              title="Delete list"
              onClick={onDeleteGroup}
              style={{ color: group.textColor }}
            >
              ✕
            </button>
            <span className="jq-group__grip" title="Drag to reorder lists">
              ⠿
            </span>
          </span>
        )}
      </div>

      {!group.collapsed && (
        <div
          className={"stage-col__body" + (dropActive ? " stage-col__body--drop" : "")}
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
          {group.items.length === 0 && !adding && (
            <div className="jq-group__empty">Empty — drag a project here, or add one.</div>
          )}

          {group.items.map((item, i) => (
            <StageCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onOpen={() => onOpenCard(item)}
              onRemove={() => onRemoveCard(item.id)}
              onDropBefore={(e) => {
                if (!canDropHere(e)) return;
                e.preventDefault();
                e.stopPropagation();
                setDropActive(false);
                acceptDrop(e, i);
              }}
            />
          ))}

          {canEdit && adding && (
            <div className="stage-col__add-form">
              <JobSearch
                autoFocus
                placeholder="Job # or customer…"
                onPick={(job) => {
                  onAddItem(stageItemFromJob(job, group.id, group.items.length));
                  setAdding(false);
                }}
                onCommitText={(text) => {
                  onAddItem(stageItemFromManual(text, "", group.id, group.items.length));
                  setAdding(false);
                }}
              />
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          )}

          {canEdit && !adding && (
            <button type="button" className="jq-add-job-btn" onClick={() => setAdding(true)}>
              + Add project
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- One staged card -------------------------------------------------------
function StageCard({
  item,
  canEdit,
  onOpen,
  onRemove,
  onDropBefore,
}: {
  item: QueueItem;
  canEdit: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onDropBefore: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={"jq-card stage-card" + (canEdit ? " jq-card--clickable" : "")}
      draggable={canEdit}
      onClick={canEdit ? onOpen : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_SHIP_STAGE, item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_SHIP_STAGE)) e.preventDefault();
      }}
      onDrop={onDropBefore}
      title={canEdit ? "Click to edit · drag onto a day or a load to add it" : undefined}
    >
      <div className="jq-card__main">
        <div className="jq-card__top">
          {item.jobNo && <span className="jq-card__jobno">{item.jobNo}</span>}
          <span className="jq-card__cust">{item.customerName || "—"}</span>
        </div>
        {item.planningLineDescription && (
          <div className="jq-card__desc">{item.planningLineDescription}</div>
        )}
      </div>
      {canEdit && (
        <div className="jq-card__side">
          <button
            type="button"
            className="jq-card__remove"
            title="Remove from staging"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// --- Edit a staged card ----------------------------------------------------
// Only the fields a shipment cares about. Stop location, delivery/pickup, and
// loading notes belong to a specific run, so they're set in the load editor.
function StageCardDialog({
  item,
  onCancel,
  onSave,
  onRemove,
}: {
  item: QueueItem;
  onCancel: () => void;
  onSave: (changes: Partial<QueueItem>) => void;
  onRemove: () => void;
}) {
  const [jobNo, setJobNo] = useState(item.jobNo);
  const [customerName, setCustomerName] = useState(item.customerName);
  const [description, setDescription] = useState(item.planningLineDescription);
  const [picking, setPicking] = useState(false);

  const save = () =>
    onSave({
      jobNo: jobNo.trim(),
      customerName: customerName.trim(),
      planningLineDescription: description,
    });

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <div className="modal-card__title">Staged project</div>
        <div className="modal-card__body">
          <div className="form-field">
            <div className="form-field__label">Job number</div>
            {picking ? (
              <JobSearch
                autoFocus
                placeholder="Job # or customer…"
                onPick={(job) => {
                  setJobNo(job.jobNo);
                  setCustomerName(job.customerName);
                  setDescription(job.description);
                  setPicking(false);
                }}
                onCommitText={(text) => {
                  setJobNo(text);
                  setPicking(false);
                }}
                onCancel={() => setPicking(false)}
              />
            ) : (
              <div style={{ display: "flex", gap: 6, padding: "6px 8px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, textAlign: "left" }}
                  onClick={() => setPicking(true)}
                  title={jobNo ? "Change the job" : "Attach a BC job"}
                >
                  {jobNo || "+ Job #"}
                </button>
                {jobNo && (
                  <button type="button" className="btn-secondary" onClick={() => setJobNo("")}>
                    Clear
                  </button>
                )}
              </div>
            )}
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
            <div className="form-field__label">Description</div>
            <textarea
              className="form-field__input"
              rows={2}
              value={description}
              placeholder="What's shipping"
              onChange={(e) => setDescription(e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
        </div>
        <div className="modal-card__actions">
          <button className="btn-danger" onClick={onRemove}>
            Remove
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={onCancel}>
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
