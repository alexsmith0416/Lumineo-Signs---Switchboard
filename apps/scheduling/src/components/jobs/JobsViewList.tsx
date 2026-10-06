import { useState } from "react";
import type { ViewLayout } from "./jobs-view-layout";

/**
 * The Jobs views sidebar (like the Airtable recreation app's): drag views and
 * sections to reorder (views can move between sections), double-click a name to
 * rename, hover a view for duplicate / delete, "+ Add view" per section and
 * "+ Add section" at the bottom. `readOnly` (users without Jobs edit rights):
 * pick a view, nothing else — the views are shared by everyone.
 */
export default function JobsViewList({
  layout,
  activeId,
  onSelect,
  onAddView,
  onDuplicate,
  onRename,
  onDelete,
  onMoveView,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onMoveSection,
  readOnly = false,
}: {
  layout: ViewLayout;
  activeId: string;
  onSelect: (id: string) => void;
  onAddView: (sectionId: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMoveView: (id: string, sectionId: string, index: number) => void;
  onAddSection: () => void;
  onRenameSection: (id: string, label: string) => void;
  onDeleteSection: (id: string) => void;
  onMoveSection: (id: string, index: number) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<{ kind: "view" | "section"; id: string; draft: string } | null>(null);
  const [drag, setDrag] = useState<{ kind: "view" | "section"; id: string } | null>(null);
  const [dropAt, setDropAt] = useState<string | null>(null); // "v:<section>:<index>" | "s:<index>"
  const viewCount = Object.keys(layout.views).length;

  const commit = () => {
    if (!editing) return;
    if (editing.kind === "view") onRename(editing.id, editing.draft);
    else onRenameSection(editing.id, editing.draft);
    setEditing(null);
  };
  const editInput = (
    <input
      className="jobs-views__input"
      autoFocus
      value={editing?.draft ?? ""}
      onChange={(e) => setEditing((x) => (x ? { ...x, draft: e.target.value } : x))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(null);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const endDrag = () => {
    setDrag(null);
    setDropAt(null);
  };
  const viewDropZone = (sectionId: string, index: number) => {
    const key = `v:${sectionId}:${index}`;
    return {
      onDragOver: (e: React.DragEvent) => {
        if (drag?.kind !== "view") return;
        e.preventDefault();
        setDropAt(key);
      },
      onDrop: (e: React.DragEvent) => {
        if (drag?.kind !== "view") return;
        e.preventDefault();
        onMoveView(drag.id, sectionId, index);
        endDrag();
      },
      "data-drop": dropAt === key ? "on" : undefined,
    };
  };
  const sectionDropZone = (index: number) => {
    const key = `s:${index}`;
    return {
      onDragOver: (e: React.DragEvent) => {
        if (drag?.kind !== "section") return;
        e.preventDefault();
        setDropAt(key);
      },
      onDrop: (e: React.DragEvent) => {
        if (drag?.kind !== "section") return;
        e.preventDefault();
        onMoveSection(drag.id, index);
        endDrag();
      },
      "data-drop": dropAt === key ? "on" : undefined,
    };
  };

  return (
    <nav className="jobs-views" aria-label="Job views" onClick={(e) => e.stopPropagation()}>
      {layout.sections.map((section, si) => (
        <div key={section.id} className="jobs-views__group">
          <div className="jobs-views__section-drop" {...sectionDropZone(si)} />
          <div
            className="jobs-views__label"
            draggable={!editing && !readOnly}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", section.id);
              setDrag({ kind: "section", id: section.id });
            }}
            onDragEnd={endDrag}
            onDoubleClick={readOnly ? undefined : () => setEditing({ kind: "section", id: section.id, draft: section.label })}
            title={readOnly ? undefined : "Drag to reorder · double-click to rename"}
          >
            {editing?.kind === "section" && editing.id === section.id ? editInput : <span>{section.label}</span>}
            {layout.sections.length > 1 && !editing && !readOnly && (
              <button
                type="button"
                className="jobs-views__icon"
                title="Delete section (its views move to the section above)"
                aria-label={`Delete section ${section.label}`}
                onClick={() => onDeleteSection(section.id)}
              >
                ✕
              </button>
            )}
          </div>

          <div className="jobs-views__drop" {...viewDropZone(section.id, 0)} />
          {section.viewIds.map((id, vi) => {
            const v = layout.views[id]!;
            return (
              <div key={id}>
                <div
                  className={`jobs-views__item${id === activeId ? " jobs-views__item--active" : ""}${drag?.id === id ? " jobs-views__item--dragging" : ""}`}
                  draggable={!editing && !readOnly}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", id);
                    setDrag({ kind: "view", id });
                  }}
                  onDragEnd={endDrag}
                  onClick={() => onSelect(id)}
                  onDoubleClick={readOnly ? undefined : () => setEditing({ kind: "view", id, draft: v.name })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(id)}
                  title={readOnly ? "Click to open" : "Click to open · drag to reorder · double-click to rename"}
                >
                  {editing?.kind === "view" && editing.id === id ? (
                    editInput
                  ) : (
                    <>
                      <span className="jobs-views__name">{v.name}</span>
                      {!readOnly && (
                      <span className="jobs-views__actions">
                        <button type="button" className="jobs-views__icon" title="Duplicate view" aria-label={`Duplicate ${v.name}`}
                          onClick={(e) => { e.stopPropagation(); onDuplicate(id); }}>⧉</button>
                        {viewCount > 1 && (
                          <button type="button" className="jobs-views__icon" title="Delete view" aria-label={`Delete ${v.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete the view "${v.name}"?`)) onDelete(id);
                            }}>✕</button>
                        )}
                      </span>
                      )}
                    </>
                  )}
                </div>
                <div className="jobs-views__drop" {...viewDropZone(section.id, vi + 1)} />
              </div>
            );
          })}
          {!readOnly && (
            <button type="button" className="jobs-views__add" onClick={() => onAddView(section.id)}>
              + Add view
            </button>
          )}
        </div>
      ))}
      <div className="jobs-views__section-drop" {...sectionDropZone(layout.sections.length)} />
      {!readOnly && (
        <button type="button" className="jobs-views__add jobs-views__add--section" onClick={onAddSection}>
          + Add section
        </button>
      )}
    </nav>
  );
}
