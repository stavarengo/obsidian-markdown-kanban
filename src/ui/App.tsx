import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Board as BoardModel } from "../model/types";
import { moveCard, resolveDrop } from "../model/board";
import type { CardRepository } from "../obsidian/repo";
import { BoardActionsContext, RepoContext, type BoardActions } from "./context";
import { Board } from "./Board";
import { CardDetail } from "./CardDetail";
import { Toolbar } from "./Toolbar";
import { cardMatches, EMPTY_FILTERS, type BoardFilters } from "./cardView";

function todayStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DONE_RE = /\b(done|complete|completed|finished|shipped|closed)\b/i;

/** Pick the column that means "finished": exact id "done", else a title/id that reads as done. */
function findDoneColumn(board: BoardModel): string | null {
  const cols = board.config.columns;
  const exact = cols.find((c) => c.id.toLowerCase() === "done");
  if (exact) return exact.id;
  const fuzzy = cols.find((c) => DONE_RE.test(c.id) || DONE_RE.test(c.title));
  return fuzzy?.id ?? null;
}

interface Props {
  repo: CardRepository;
  /** Overridable for deterministic tests; defaults to the real date. */
  today?: string;
}

export function App({ repo, today }: Props) {
  const [board, setBoard] = useState<BoardModel | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const searchRef = useRef<HTMLInputElement>(null);
  const todayValue = useMemo(() => today ?? todayStr(), [today]);

  const load = useCallback(async () => {
    try {
      setBoard(await repo.loadBoard());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [repo]);

  useEffect(() => {
    void load();
    const off = repo.onChange(() => void load());
    return off;
  }, [load, repo]);

  const onMove = useCallback(
    async (activeId: string, overId: string) => {
      if (!board) return;
      const drop = resolveDrop(board, activeId, overId);
      if (!drop) return;
      const mut = moveCard(board, activeId, drop.columnId, drop.index);
      if (!mut) return;
      try {
        await repo.applyMove(mut);
      } finally {
        await load();
      }
    },
    [board, repo, load],
  );

  const onAddCard = useCallback(
    async (columnId: string, title: string) => {
      const path = await repo.createCard(title, columnId);
      await load();
      setSelected(path);
    },
    [repo, load],
  );

  const doneColumnId = useMemo(() => (board ? findDoneColumn(board) : null), [board]);

  const moveTo = useCallback(
    async (path: string, columnId: string) => {
      if (!board) return;
      const target = (board.columns[columnId] ?? []).filter((p) => p !== path).length;
      const mut = moveCard(board, path, columnId, target);
      if (!mut) return;
      try {
        await repo.applyMove(mut);
      } finally {
        await load();
      }
    },
    [board, repo, load],
  );

  const actions = useMemo<BoardActions>(
    () => ({
      open: (path) => setSelected(path),
      move: (path, columnId) => void moveTo(path, columnId),
      complete: (path) => {
        if (doneColumnId) void moveTo(path, doneColumnId);
      },
      remove: (path) => {
        void (async () => {
          try {
            await repo.deleteCard(path);
          } finally {
            setSelected((cur) => (cur === path ? null : cur));
            await load();
          }
        })();
      },
      openNote: (path) => void repo.openCard(path),
      doneColumnId,
    }),
    [moveTo, doneColumnId, repo, load],
  );

  const wipLimits = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (board) for (const c of board.config.columns) if (typeof c.limit === "number") map[c.id] = c.limit;
    return map;
  }, [board]);

  const counts = useMemo(() => {
    let total = 0;
    let match = 0;
    if (board) {
      for (const col of board.config.columns) {
        for (const p of board.columns[col.id] ?? []) {
          const c = board.cards[p];
          if (!c) continue;
          total++;
          if (cardMatches(c, todayValue, filters)) match++;
        }
      }
    }
    return { total, match };
  }, [board, filters, todayValue]);

  // "/" focuses search (when not already typing in a field).
  const onRootKeyDown = (e: KeyboardEvent) => {
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target as HTMLElement;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
  };

  if (error) return <div className="mdkb-error">Couldn’t load the board: {error}</div>;
  if (!board) return <div className="mdkb-loading">Loading board…</div>;

  return (
    <RepoContext.Provider value={repo}>
      <BoardActionsContext.Provider value={actions}>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className="mdkb-root" onKeyDown={onRootKeyDown}>
          <Toolbar ref={searchRef} filters={filters} onChange={setFilters} matchCount={counts.match} totalCount={counts.total} />
          <div className="mdkb-main">
            <Board
              board={board}
              today={todayValue}
              selectedPath={selected}
              wipLimits={wipLimits}
              filters={filters}
              onMove={onMove}
              onAddCard={onAddCard}
            />
            {selected && board.cards[selected] && (
              <CardDetail
                path={selected}
                board={board}
                onClose={() => setSelected(null)}
                onNavigate={setSelected}
                onChanged={load}
              />
            )}
          </div>
        </div>
      </BoardActionsContext.Provider>
    </RepoContext.Provider>
  );
}
