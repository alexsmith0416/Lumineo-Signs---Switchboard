import { useEffect, useMemo, useRef, useState } from "react";
import type { Department, Employee } from "../engine/types";
import type { QueueKind } from "../services/job-queue-data";
import type { UseScheduleStore } from "../store/schedule-store";
import { bucketStoreFor } from "../store/bucket-store";
import { useJobRows } from "../hooks/useJobRows";
import { deptKeyForName, stepLabel } from "../services/production-steps";
import { viewSort, type BucketList, type ViewSort } from "../services/buckets";
import AddJobPanel from "./AddJobPanel";
import BucketDialog from "./BucketDialog";
import ConfirmDialog from "./ConfirmDialog";

const DND_BUCKET_ITEM = "text/bucketitemid";

/**
 * The Job Queue's "Bucket Lists" tab (services/buckets.ts): ongoing lists of
 * jobs per board. Jobs are listed oldest-released first unless dragged into a
 * hand order; finished jobs drop off by themselves (useBucketSync).
 */
export default function BucketListsTab({
  kind,
  scheduleStore,
  canEdit,
  employees,
  departments,
  sort,
  focusBucketId,
}: {
  kind: QueueKind;
  scheduleStore: UseScheduleStore;
  canEdit: boolean;
  employees: readonly Employee[];
  departments: readonly Department[];
  sort: ViewSort;
  focusBucketId?: string | null;
}) {
  const store = bucketStoreFor(kind);
  const lists = store((s) => s.lists);
  const items = store((s) => s.items);
  const loaded = store((s) => s.loaded);
  const load = store((s) => s.load);
  const { addList, updateList, deleteList, addJob, removeItem, moveItem, resetOrder } = store.getState();
  const rows = useJobRows();
  const rowByJob = useMemo(() => new Map(rows.map((r) => [r.jobNo, r])), [rows]);
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; list: BucketList } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BucketList | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusBucketId, loaded]);

  // The board's first department → the step a new bucket drops jobs on.
  const defaultDeptKey = (departments[0] && deptKeyForName(departments[0].name)) || "";
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? "someone";
  const sorted = [...lists].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {!loaded && <div className="job-queue__empty-all">Loading…</div>}
      {loaded && sorted.length === 0 && (
        <div className="job-queue__empty-all">
          No bucket lists yet.
          {canEdit && " A bucket is an ongoing list of jobs — add one below."}
        </div>
      )}
      {sorted.map((list) => {
        const ordered = store.getState().itemsOf(list.id);
        const shown = viewSort(ordered, sort, (j) => rowByJob.get(j));
        const handOrder = ordered.some((i) => i.pinned);
        const canDrag = canEdit && sort === "list";
        return (
          <div key={list.id} className="bucket" ref={list.id === focusBucketId ? focusRef : undefined}>
            <div className="bucket__head" style={{ background: list.color, color: list.textColor }}>
              <button
                type="button"
                className="bucket__toggle"
                onClick={() => updateList(list.id, { collapsed: !list.collapsed })}
                aria-expanded={!list.collapsed}
              >
                {list.collapsed ? "▸" : "▾"} {list.name}
              </button>
              <span className="bucket__count">{ordered.length}</span>
              {canEdit && (
                <>
                  <button type="button" className="bucket__icon" title="Edit this bucket" onClick={() => setDialog({ mode: "edit", list })}>
                    ✎
                  </button>
                  <button type="button" className="bucket__icon" title="Delete this bucket" onClick={() => setConfirmDelete(list)}>
                    ✕
                  </button>
                </>
              )}
            </div>
            {!list.collapsed && (
              <div className="bucket__body">
                <div className="bucket__meta">
                  {list.mode === "filter" ? "From a filter" : "Added by hand"}
                  {list.deptKey ? ` · drops a job when ${stepLabel(list.deptKey)} is done` : ""}
                  {list.defaultEmployees.length ? ` · fills ${list.defaultEmployees.map(nameOf).join(", ")}'s free time` : ""}
                  {list.description ? <div>{list.description}</div> : null}
                </div>
                {shown.length === 0 && <div className="bucket__empty">No jobs on this list.</div>}
                <ol className="bucket__items">
                  {shown.map((it, idx) => {
                    const row = rowByJob.get(it.jobNo);
                    return (
                      <li
                        key={it.id}
                        className={"bucket__item" + (dragId === it.id ? " bucket__item--drag" : "")}
                        draggable={canDrag}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DND_BUCKET_ITEM, it.id);
                          setDragId(it.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        onDragOver={(e) => {
                          if (canDrag && dragId) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData(DND_BUCKET_ITEM);
                          if (id && id !== it.id) moveItem(id, idx);
                          setDragId(null);
                        }}
                      >
                        <span className="bucket__n">{idx + 1}</span>
                        <span className="bucket__job">
                          <strong>{it.jobNo}</strong> {it.customerName}
                          {it.task && <span className="bucket__task">{it.task.split("\n")[0]}</span>}
                        </span>
                        <span className="bucket__date" title="Released">
                          {(row?.releaseDate || it.releasedDate || "").slice(5).replace("-", "/")}
                        </span>
                        {canEdit && (
                          <button type="button" className="bucket__x" title="Take off this list" onClick={() => removeItem(it.id)}>
                            ×
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {canEdit && (
                  <div className="bucket__actions">
                    <button type="button" className="bucket__link" onClick={() => setAddingTo(list.id)}>
                      + Add job
                    </button>
                    {handOrder && sort === "list" && (
                      <button type="button" className="bucket__link" onClick={() => resetOrder(list.id)}>
                        Reset to released-date order
                      </button>
                    )}
                    {sort !== "list" && <span className="bucket__hint">Switch to List order to drag</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {canEdit && (
        <button type="button" className="job-queue__add-group" onClick={() => setDialog({ mode: "add" })}>
          + New bucket list
        </button>
      )}

      {dialog && (
        <BucketDialog
          initial={dialog.mode === "edit" ? dialog.list : undefined}
          rows={rows}
          employees={employees}
          defaultDeptKey={defaultDeptKey}
          onCancel={() => setDialog(null)}
          onSave={(vals) => {
            if (dialog.mode === "edit") updateList(dialog.list.id, vals);
            else addList(vals);
            setDialog(null);
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}"?`}
          message="The list and its jobs are removed (the jobs themselves aren't touched). Its cards leave the board."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteList(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {addingTo && (
        <AddJobPanel
          useStore={scheduleStore}
          bcOnly
          confirmLabel="Add to bucket"
          onConfigure={(draft) => {
            const row = rowByJob.get(draft.jobNo);
            addJob(addingTo, {
              jobNo: draft.jobNo,
              customerName: draft.customerName,
              task: draft.planningLineDescription ?? "",
              estimatedHours: draft.overrideHours ?? draft.estimatedHours,
              releasedDate: row?.releaseDate ?? "",
            });
            setAddingTo(null);
          }}
          onClose={() => setAddingTo(null)}
        />
      )}
    </>
  );
}
