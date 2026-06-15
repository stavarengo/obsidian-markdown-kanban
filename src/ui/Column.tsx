import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Board, ColumnDef } from "../model/types";
import { CardItem } from "./CardItem";
import { ColumnMenu } from "./ColumnMenu";
import { Icon } from "./icons";
import { cardMatches, hasActiveFilter, type BoardFilters } from "./cardView";

interface Props {
  column: ColumnDef;
  cardPaths: string[];
  board: Board;
  today: string;
  selectedPath: string | null;
  wipLimit?: number;
  filters: BoardFilters;
  isFirst: boolean;
  isLast: boolean;
  onAddCard: (columnId: string, title: string) => void;
}

export function Column({ column, cardPaths, board, today, selectedPath, wipLimit, filters, isFirst, isLast, onAddCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const submit = (keepOpen: boolean) => {
    const t = title.trim();
    if (t) onAddCard(column.id, t);
    setTitle("");
    if (!keepOpen) setAdding(false);
  };

  const allPaths = cardPaths.filter((p) => board.cards[p]);
  const filtering = hasActiveFilter(filters);
  const paths = filtering ? allPaths.filter((p) => cardMatches(board.cards[p], today, filters)) : allPaths;
  const overLimit = wipLimit != null && allPaths.length > wipLimit;
  const accent = column.color || "var(--interactive-accent)";

  return (
    <section
      className={"mdkb-column" + (overLimit ? " is-over-limit" : "")}
      data-testid="column"
      data-column={column.id}
      style={{ ["--mdkb-col-accent" as string]: accent }}
    >
      <header className="mdkb-column-header">
        <span className="mdkb-column-dot" aria-hidden="true" />
        <span className="mdkb-column-title">{column.title}</span>
        <span
          className={"mdkb-column-count" + (overLimit ? " is-over-limit" : "")}
          title={wipLimit != null ? `${allPaths.length} of ${wipLimit} (WIP limit)` : `${allPaths.length} cards`}
        >
          {wipLimit != null ? `${allPaths.length}/${wipLimit}` : allPaths.length}
        </span>
        <button
          className="mdkb-icon-btn mdkb-column-menu-btn"
          aria-label={`Column options for ${column.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name="more" size={16} />
        </button>
        {menuOpen && <ColumnMenu column={column} isFirst={isFirst} isLast={isLast} onClose={() => setMenuOpen(false)} />}
      </header>
      <div ref={setNodeRef} className={"mdkb-column-body" + (isOver ? " is-over" : "")}>
        <SortableContext items={paths} strategy={verticalListSortingStrategy}>
          {paths.map((p) => (
            <CardItem key={p} card={board.cards[p]} today={today} selected={p === selectedPath} />
          ))}
        </SortableContext>
        {paths.length === 0 && !adding && (
          filtering ? (
            <div className="mdkb-column-empty is-filtered">
              <span>No matches</span>
            </div>
          ) : (
            <div className="mdkb-column-empty" aria-hidden="true">
              <Icon name="inbox" size={20} />
              <span>Nothing here</span>
            </div>
          )
        )}
        {adding && (
          <div className="mdkb-add-card">
            <textarea
              autoFocus
              rows={2}
              value={title}
              placeholder="What needs doing?"
              aria-label="New card title"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(false);
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setTitle("");
                }
              }}
            />
            <div className="mdkb-row-actions">
              <button className="mdkb-btn mdkb-btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(false)}>
                Add card
              </button>
              <button className="mdkb-btn" onClick={() => { setAdding(false); setTitle(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {!adding && (
        <button className="mdkb-column-add" aria-label={`Add card to ${column.title}`} onClick={() => setAdding(true)}>
          <Icon name="plus" size={15} />
          Add a card
        </button>
      )}
    </section>
  );
}
