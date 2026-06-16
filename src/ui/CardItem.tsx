import { memo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card, CardStats } from "../model/types";
import { cardChips, priorityTone } from "./cardView";
import { CardContextMenu, type ContextTarget } from "./CardContextMenu";
import { useBoardActions, useSettings } from "./context";
import { Icon } from "./icons";

interface Props {
  card: Card;
  today: string;
  selected: boolean;
  /** A nested subcard rendered inside its parent's `.mdkb-subcard-group`: not drag-reorderable,
   *  rendered without a drag affordance, but keeps click/keyboard open and the context menu. */
  nested?: boolean;
}

function CardItemInner({ card, today, selected, nested = false }: Props) {
  const actions = useBoardActions();
  const { cardNextTodos } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [menu, setMenu] = useState<ContextTarget | null>(null);
  // Hooks can't be conditional, so always call useSortable — but disable it for nested children so
  // they aren't draggable and aren't registered as drop targets in the parent's SortableContext.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.path,
    disabled: nested,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const chips = cardChips(card, today, actions.doneColumnId);
  const stats = card.stats;
  const fm = card.frontmatter;
  const prio = typeof fm.priority === "string" && fm.priority ? priorityTone(fm.priority) : null;

  const allDone = !!stats && stats.checklist > 0 && stats.checklistDone === stats.checklist;
  const showActions = !confirming;
  const canComplete = actions.doneColumnId != null && fm.status !== actions.doneColumnId;

  const open = () => {
    if (!isDragging) actions.open(card.path);
  };
  // Right-click opens a context-aware menu. preventDefault stops Obsidian's own context menu;
  // dnd-kit's PointerSensor only activates on the left button, so this never starts a drag.
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const todoEl = (e.target as HTMLElement).closest(".mdkb-card-next-todo");
    const todoIndex = todoEl ? Number(todoEl.getAttribute("data-todo-index")) : NaN;
    setMenu(
      todoEl && Number.isFinite(todoIndex)
        ? { x: e.clientX, y: e.clientY, kind: "todo", todoIndex }
        : { x: e.clientX, y: e.clientY, kind: "card" },
    );
  };
  // Merge dnd-kit keyboard handling (Space = pick up) with Enter = open.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      actions.open(card.path);
      return;
    }
    (listeners as { onKeyDown?: (e: KeyboardEvent) => void } | undefined)?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "mdkb-card" +
        (nested ? " mdkb-card--nested" : "") +
        (selected ? " is-selected" : "") +
        (isDragging ? " is-dragging" : "")
      }
      data-testid="card"
      data-path={card.path}
      data-prio={prio ?? undefined}
      onContextMenu={onContextMenu}
    >
      <div
        className="mdkb-card-main"
        // Nested cards aren't draggable: skip the drag listeners/attributes (which also supply
        // tabIndex/role), and restore keyboard reachability + open semantics explicitly.
        {...(nested ? { tabIndex: 0, role: "button" } : attributes)}
        {...(nested ? {} : listeners)}
        onClick={open}
        onKeyDown={onKeyDown}
        aria-label={card.basename}
        aria-current={selected ? "true" : undefined}
      >
        <div className="mdkb-card-title">{card.basename}</div>
        {chips.length > 0 && (
          <div className="mdkb-chips">
            {chips.map((c) => (
              <span key={c.key} className={`mdkb-chip mdkb-chip-${c.tone}`} title={c.title}>
                {c.icon && <Icon name={c.icon} size={11} />}
                {c.label}
              </span>
            ))}
          </div>
        )}
        {stats && stats.checklist > 0 && (
          <div
            className={"mdkb-progress" + (allDone ? " is-complete" : "")}
            title={`${stats.checklistDone} of ${stats.checklist} subtasks done`}
            aria-label={`${stats.checklistDone} of ${stats.checklist} subtasks done`}
          >
            <div className="mdkb-progress-track">
              <div
                className="mdkb-progress-fill"
                style={{ width: `${(stats.checklistDone / stats.checklist) * 100}%` }}
              />
            </div>
            <span className="mdkb-progress-label">
              {allDone ? <Icon name="check" size={12} /> : null}
              {stats.checklistDone}/{stats.checklist}
            </span>
          </div>
        )}
        {stats && cardNextTodos > 0 && stats.nextTodos.length > 0 && (
          <ul className="mdkb-card-next-todos">
            {stats.nextTodos.slice(0, cardNextTodos).map((t) => (
              <li key={t.index} className="mdkb-card-next-todo" data-todo-index={t.index}>
                <span className="mdkb-card-next-todo-mark" aria-hidden="true" />
                <span className="mdkb-card-next-todo-text">{t.text}</span>
              </li>
            ))}
          </ul>
        )}
        {stats && (stats.subcards > 0 || stats.comments > 0) && (
          <div className="mdkb-card-meta">
            {stats.subcards > 0 && (
              <span title="Subcards" aria-label={`${stats.subcards} subcard${stats.subcards === 1 ? "" : "s"}`}>
                <Icon name="git-branch" size={13} /> {stats.subcards}
              </span>
            )}
            {stats.comments > 0 && (
              <span title="Comments" aria-label={`${stats.comments} comment${stats.comments === 1 ? "" : "s"}`}>
                <Icon name="message" size={13} /> {stats.comments}
              </span>
            )}
          </div>
        )}
      </div>

      {showActions && (
        <div className="mdkb-card-actions">
          {canComplete && (
            <button
              className="mdkb-icon-btn mdkb-action-done"
              aria-label={`Mark "${card.basename}" done`}
              title="Mark done"
              onClick={(e) => {
                e.stopPropagation();
                actions.complete(card.path);
              }}
            >
              <Icon name="check-circle" size={15} />
            </button>
          )}
          <button
            className="mdkb-icon-btn"
            aria-label={`Open note for "${card.basename}"`}
            title="Open note"
            onClick={(e) => {
              e.stopPropagation();
              actions.openNote(card.path);
            }}
          >
            <Icon name="external-link" size={15} />
          </button>
          <button
            className="mdkb-icon-btn mdkb-action-delete"
            aria-label={`Delete "${card.basename}"`}
            title="Delete card"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      )}

      {confirming && (
        <div className="mdkb-card-confirm" role="alertdialog" aria-label={`Delete ${card.basename}?`}>
          <span>Delete card?</span>
          <div className="mdkb-row-actions">
            <button
              className="mdkb-btn mdkb-btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                actions.remove(card.path);
              }}
            >
              Delete
            </button>
            <button
              className="mdkb-btn"
              autoFocus
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {menu &&
        (() => {
          const edges = actions.columnEdges(card.path);
          return (
            <CardContextMenu
              target={menu}
              path={card.path}
              priority={typeof fm.priority === "string" ? fm.priority : ""}
              isDone={!canComplete}
              canMoveUp={edges.canMoveUp}
              canMoveDown={edges.canMoveDown}
              onClose={() => setMenu(null)}
            />
          );
        })()}
    </div>
  );
}

function sameStats(a?: CardStats, b?: CardStats): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.checklist === b.checklist &&
    a.checklistDone === b.checklistDone &&
    a.subcards === b.subcards &&
    a.comments === b.comments &&
    a.nextTodos.map((t) => `${t.index}:${t.text}`).join("\n") ===
      b.nextTodos.map((t) => `${t.index}:${t.text}`).join("\n")
  );
}

// A board reload rebuilds Card objects, but an unchanged card keeps the same frontmatter
// reference (Obsidian's metadataCache) — so only genuinely-changed cards re-render.
export const CardItem = memo(
  CardItemInner,
  (a, b) =>
    a.selected === b.selected &&
    a.nested === b.nested &&
    a.today === b.today &&
    a.card.path === b.card.path &&
    a.card.basename === b.card.basename &&
    a.card.frontmatter === b.card.frontmatter &&
    sameStats(a.card.stats, b.card.stats),
);
