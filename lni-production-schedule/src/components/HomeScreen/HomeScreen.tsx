import { useState, useRef, useEffect } from 'react';
import type { Schedule } from '../../hooks/useSchedules';

interface Props {
  schedules: Schedule[];
  onCreate: (name: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScheduleCard({
  schedule, onOpen, onDuplicate, onRename, onDelete, canDelete,
}: {
  schedule: Schedule;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(schedule.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const commitRename = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div className="hs-card" style={{ borderTopColor: schedule.color }}>
      <div className="hs-card-color-bar" style={{ background: schedule.color }} />
      <div className="hs-card-body">
        {editing ? (
          <input
            ref={inputRef}
            className="hs-card-name-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(schedule.name); setEditing(false); }
            }}
          />
        ) : (
          <div className="hs-card-name" onDoubleClick={() => { setDraft(schedule.name); setEditing(true); }}>
            {schedule.name}
          </div>
        )}
        <div className="hs-card-meta">Created {formatDate(schedule.createdAt)}</div>
      </div>
      <div className="hs-card-footer">
        <button className="hs-open-btn" onClick={onOpen} style={{ background: schedule.color }}>
          Open
        </button>
        <div className="hs-menu-wrap" ref={menuRef}>
          <button className="hs-menu-btn" onClick={() => setMenuOpen(p => !p)}>⋯</button>
          {menuOpen && (
            <div className="hs-menu">
              <button onClick={() => { setDraft(schedule.name); setEditing(true); setMenuOpen(false); }}>
                Rename
              </button>
              <button onClick={() => { onDuplicate(); setMenuOpen(false); }}>
                Duplicate
              </button>
              {canDelete && (
                confirmDelete ? (
                  <button className="hs-menu-danger" onClick={() => { onDelete(); setMenuOpen(false); }}>
                    Confirm delete
                  </button>
                ) : (
                  <button className="hs-menu-danger" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomeScreen({ schedules, onCreate, onDuplicate, onRename, onDelete, onOpen }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const commitCreate = () => {
    onCreate(newName.trim() || 'New Schedule');
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="hs-root">
      <div className="hs-header">
        <div className="hs-header-brand">
          <div className="logo-icon" style={{ width: 36, height: 36 }}>
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <circle cx="12" cy="12" r="4" fill="white"/>
              <line x1="12" y1="2"  x2="12" y2="6"  stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="2"  y1="12" x2="6"  y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="18" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="4.93" y1="4.93"   x2="7.76"  y2="7.76"  stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="19.07" y1="4.93"  x2="16.24" y2="7.76"  stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="7.76"  y1="16.24" x2="4.93"  y2="19.07" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="logo-text">LUMINEO SIGNS</div>
            <div className="logo-sub">Production Schedules</div>
          </div>
        </div>
        <div className="hs-header-actions">
          {creating ? (
            <div className="hs-new-form">
              <input
                ref={inputRef}
                className="hs-new-input"
                placeholder="Schedule name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitCreate();
                  if (e.key === 'Escape') { setNewName(''); setCreating(false); }
                }}
              />
              <button className="h-btn" onClick={commitCreate}>Create</button>
              <button className="h-btn sec" onClick={() => { setNewName(''); setCreating(false); }}>Cancel</button>
            </div>
          ) : (
            <button className="h-btn" onClick={() => setCreating(true)}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
                <path d="M7 1v12M1 7h12"/>
              </svg>
              New Schedule
            </button>
          )}
        </div>
      </div>

      <div className="hs-body">
        <div className="hs-section-title">Your Schedules</div>
        <div className="hs-grid">
          {schedules.map(s => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              canDelete={schedules.length > 1}
              onOpen={() => onOpen(s.id)}
              onDuplicate={() => onDuplicate(s.id)}
              onRename={name => onRename(s.id, name)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
