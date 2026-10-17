import { create } from "zustand";

/**
 * Cards selected with Ctrl+click on a board (one board at a time). JobCard
 * reads it for the selected outline; the board acts on the set (move / copy /
 * cut / paste / delete / lock / make group card). Plain click or Esc clears.
 */
interface SelectionState {
  boardId: string | null;
  ids: ReadonlySet<string>;
  toggle: (boardId: string, id: string) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  boardId: null,
  ids: new Set(),
  toggle: (boardId, id) => {
    const cur = get().boardId === boardId ? new Set(get().ids) : new Set<string>();
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    set({ boardId: cur.size ? boardId : null, ids: cur });
  },
  clear: () => {
    if (get().ids.size) set({ boardId: null, ids: new Set() });
  },
}));

export const useIsSelected = (id: string): boolean => useSelectionStore((s) => s.ids.has(id));
