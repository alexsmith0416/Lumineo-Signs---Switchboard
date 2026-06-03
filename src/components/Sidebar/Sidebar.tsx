import { useState, useRef, useEffect } from 'react';
import { PRINT_VIEWS } from '../../data/viewConfigs';
import type { SidebarGroup } from '../../hooks/useSidebarLayout';

interface Props {
  activeView: string;
  onViewChange: (name: string) => void;
  getDisplayName: (key: string) => string;
  setDisplayName: (key: string, name: string) => void;
  groups: SidebarGroup[];
  moveView: (viewKey: string, toGroupId: string, toIndex: number) => void;
  moveGroup: (groupId: string, toIndex: number) => void;
  renameGroup: (groupId: string, label: string) => void;
  addGroup: (label: string) => void;
  deleteGroup: (groupId: string) => void;
  onAddView: (name: string) => void;
}

const GridIcon = () => (
  <svg viewBox="0 0 13 13" fill="currentColor" width="13" height="13">
    <rect y="0" width="13" height="3" rx="1"/>
    <rect y="5" width="13" height="3" rx="1"/>
    <rect y="10" width="13" height="3" rx="1"/>
  </svg>
);

const PrintIcon = () => (
  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" width="13" height="13">
    <rect x="2" y="0" width="9" height="13" rx="1"/>
    <line x1="4" y1="4"   x2="9" y2="4"/>
    <line x1="4" y1="6.5" x2="9" y2="6.5"/>
    <line x1="4" y1="9"   x2="7" y2="9"/>
  </svg>
);

const DragHandle = () => (
  <svg viewBox="0 0 6 14" fill="currentColor" width="6" height="14" className="sb-drag-handle">
    <circle cx="2" cy="2" r="1"/><circle cx="2" cy="6" r="1"/><circle cx="2" cy="10" r="1"/>
    <circle cx="5" cy="2" r="1"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="10" r="1"/>
  </svg>
);

type DropTarget =
  | { kind: 'view'; groupId: string; index: number }
  | { kind: 'group'; index: number };

export default function Sidebar({
  activeView, onViewChange,
  getDisplayName, setDisplayName,
  groups, moveView, moveGroup, renameGroup, addGroup, deleteGroup, onAddView,
}: Props) {
  // drag state
  const dragView = useRef<string | null>(null);
  const dragGroupId = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // inline editing state
  const [editingView, setEditingView] = useState<string | null>(null);
  const [viewDraft, setViewDraft] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [addingView, setAddingView] = useState(false);
  const [newViewLabel, setNewViewLabel] = useState('');

  const viewInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const newGroupRef = useRef<HTMLInputElement>(null);
  const newViewRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingView) viewInputRef.current?.select(); }, [editingView]);
  useEffect(() => { if (editingGroup) groupInputRef.current?.select(); }, [editingGroup]);
  useEffect(() => { if (addingGroup) newGroupRef.current?.focus(); }, [addingGroup]);
  useEffect(() => { if (addingView) newViewRef.current?.focus(); }, [addingView]);

  // ── view drag ────────────────────────────────────────────────────────────────

  const onViewDragStart = (e: React.DragEvent, key: string) => {
    dragView.current = key;
    dragGroupId.current = null;
    e.dataTransfer.effectAllowed = 'move';
  };

  const onViewDragOver = (e: React.DragEvent, groupId: string, index: number) => {
    if (!dragView.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ kind: 'view', groupId, index });
  };

  const onViewDrop = (e: React.DragEvent, groupId: string, index: number) => {
    e.preventDefault();
    if (dragView.current) moveView(dragView.current, groupId, index);
    dragView.current = null;
    setDropTarget(null);
  };

  // ── group drag ───────────────────────────────────────────────────────────────

  const onGroupDragStart = (e: React.DragEvent, groupId: string) => {
    dragGroupId.current = groupId;
    dragView.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const onGroupDragOver = (e: React.DragEvent, index: number) => {
    if (!dragGroupId.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ kind: 'group', index });
  };

  const onGroupDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragGroupId.current) moveGroup(dragGroupId.current, index);
    dragGroupId.current = null;
    setDropTarget(null);
  };

  const onDragEnd = () => {
    dragView.current = null;
    dragGroupId.current = null;
    setDropTarget(null);
  };

  // ── helpers ──────────────────────────────────────────────────────────────────

  const isViewDrop = (groupId: string, index: number) =>
    dropTarget?.kind === 'view' && dropTarget.groupId === groupId && dropTarget.index === index;

  const isGroupDrop = (index: number) =>
    dropTarget?.kind === 'group' && dropTarget.index === index;

  const commitViewRename = (key: string) => {
    setDisplayName(key, viewDraft);
    setEditingView(null);
  };

  const commitGroupRename = (id: string) => {
    renameGroup(id, groupDraft);
    setEditingGroup(null);
  };

  const commitAddGroup = () => {
    if (newGroupLabel.trim()) addGroup(newGroupLabel.trim());
    setNewGroupLabel('');
    setAddingGroup(false);
  };

  const commitAddView = () => {
    const name = newViewLabel.trim();
    if (name) onAddView(name);
    setNewViewLabel('');
    setAddingView(false);
  };

  return (
    <aside className="sidebar">
      <div className="sb-label">Views</div>

      {groups.map((group, gi) => (
        <div key={group.id} className="sb-group">
          {/* group drop zone above */}
          {isGroupDrop(gi) && <div className="sb-drop-line group" />}

          {/* group header */}
          <div
            className="sb-group-header"
            draggable
            onDragStart={e => onGroupDragStart(e, group.id)}
            onDragOver={e => onGroupDragOver(e, gi)}
            onDrop={e => onGroupDrop(e, gi)}
            onDragEnd={onDragEnd}
          >
            <DragHandle />
            {editingGroup === group.id ? (
              <input
                ref={groupInputRef}
                className="sb-group-input"
                value={groupDraft}
                onChange={e => setGroupDraft(e.target.value)}
                onBlur={() => commitGroupRename(group.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitGroupRename(group.id);
                  if (e.key === 'Escape') setEditingGroup(null);
                  e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="sb-group-label"
                onDoubleClick={() => { setGroupDraft(group.label); setEditingGroup(group.id); }}
                title="Double-click to rename group"
              >{group.label}</span>
            )}
            {groups.length > 1 && (
              <button
                className="sb-group-delete"
                title="Delete group"
                onClick={() => deleteGroup(group.id)}
              >×</button>
            )}
          </div>

          {/* view drop zone at top of group */}
          <div
            className={`sb-drop-zone${isViewDrop(group.id, 0) ? ' active' : ''}`}
            onDragOver={e => onViewDragOver(e, group.id, 0)}
            onDrop={e => onViewDrop(e, group.id, 0)}
          />

          {group.views.map((name, vi) => {
            const displayName = getDisplayName(name);
            return (
              <div key={name}>
                <div
                  className={`view-item${activeView === name ? ' active' : ''}`}
                  draggable
                  onDragStart={e => onViewDragStart(e, name)}
                  onDragEnd={onDragEnd}
                  onClick={() => !editingView && onViewChange(name)}
                  onDoubleClick={() => { setViewDraft(displayName); setEditingView(name); }}
                  title="Double-click to rename"
                >
                  <DragHandle />
                  {PRINT_VIEWS.has(name) ? <PrintIcon /> : <GridIcon />}
                  {editingView === name ? (
                    <input
                      ref={viewInputRef}
                      className="view-rename-input"
                      value={viewDraft}
                      onChange={e => setViewDraft(e.target.value)}
                      onBlur={() => commitViewRename(name)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitViewRename(name);
                        if (e.key === 'Escape') setEditingView(null);
                        e.stopPropagation();
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="view-item-label">{displayName}</span>
                  )}
                  {!editingView && displayName !== name && (
                    <button
                      className="view-reset-btn"
                      title="Reset to original name"
                      onClick={e => { e.stopPropagation(); setDisplayName(name, name); }}
                    >↺</button>
                  )}
                </div>

                {/* view drop zone after each item */}
                <div
                  className={`sb-drop-zone${isViewDrop(group.id, vi + 1) ? ' active' : ''}`}
                  onDragOver={e => onViewDragOver(e, group.id, vi + 1)}
                  onDrop={e => onViewDrop(e, group.id, vi + 1)}
                />
              </div>
            );
          })}
        </div>
      ))}

      {/* drop zone after all groups */}
      {isGroupDrop(groups.length) && <div className="sb-drop-line group" />}
      <div
        style={{ height: 4 }}
        onDragOver={e => onGroupDragOver(e, groups.length)}
        onDrop={e => onGroupDrop(e, groups.length)}
      />

      {/* add view */}
      <div className="sb-add-group">
        {addingView ? (
          <input
            ref={newViewRef}
            className="sb-group-input"
            placeholder="View name…"
            value={newViewLabel}
            onChange={e => setNewViewLabel(e.target.value)}
            onBlur={commitAddView}
            onKeyDown={e => {
              if (e.key === 'Enter') commitAddView();
              if (e.key === 'Escape') { setNewViewLabel(''); setAddingView(false); }
            }}
          />
        ) : (
          <button className="sb-add-group-btn" style={{ color: 'var(--navy)', fontWeight: 700 }} onClick={() => setAddingView(true)}>
            + Add view
          </button>
        )}
      </div>

      {/* add group */}
      <div className="sb-add-group">
        {addingGroup ? (
          <input
            ref={newGroupRef}
            className="sb-group-input"
            placeholder="Group name…"
            value={newGroupLabel}
            onChange={e => setNewGroupLabel(e.target.value)}
            onBlur={commitAddGroup}
            onKeyDown={e => {
              if (e.key === 'Enter') commitAddGroup();
              if (e.key === 'Escape') { setNewGroupLabel(''); setAddingGroup(false); }
            }}
          />
        ) : (
          <button className="sb-add-group-btn" onClick={() => setAddingGroup(true)}>
            + Add group
          </button>
        )}
      </div>

      <div className="sb-footer">
        <div className="bc-sync">
          <div className="bc-dot" />
          Connected to BC
        </div>
      </div>
    </aside>
  );
}
