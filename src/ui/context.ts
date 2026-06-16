import { createContext, useContext } from "react";
import type { CardRepository } from "../obsidian/repo";
import type { KanbanSettings } from "../settings";

export const RepoContext = createContext<CardRepository | null>(null);

export function useRepo(): CardRepository {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error("RepoContext is missing a provider");
  return repo;
}

/** Live settings plus an updater, provided by App and fed from the view/plugin. */
export interface SettingsContextValue {
  settings: KanbanSettings;
  update: (patch: Partial<KanbanSettings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): KanbanSettings {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("SettingsContext missing");
  return c.settings;
}

export function useSettingsUpdater(): (patch: Partial<KanbanSettings>) => void {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("SettingsContext missing");
  return c.update;
}

/** Card-level actions, provided by App so cards/columns don't prop-drill callbacks. */
export interface BoardActions {
  /** Open the card's detail panel. */
  open(path: string): void;
  /** Move a card to the board's "done" column, if one exists. */
  complete(path: string): void;
  /** Trash the card's note (after confirmation in the UI). */
  remove(path: string): void;
  /** Open the underlying note in an Obsidian tab. */
  openNote(path: string): void;
  /** Id of the column treated as "done", or null if the board has none. */
  doneColumnId: string | null;

  /** Column management (persists to the board note frontmatter). */
  renameColumn(id: string, title: string): void;
  setColumnColor(id: string, color: string | null): void;
  setColumnLimit(id: string, limit: number | null): void;
  moveColumn(id: string, dir: -1 | 1): void;
  deleteColumn(id: string): void;
  addColumn(title: string): void;
}

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
  const a = useContext(BoardActionsContext);
  if (!a) throw new Error("BoardActionsContext is missing a provider");
  return a;
}
