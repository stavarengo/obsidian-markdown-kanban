import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Board as BoardModel } from "../model/types";
import { Column } from "./Column";
import { cardChips, priorityTone, type BoardFilters } from "./cardView";

interface Props {
  board: BoardModel;
  today: string;
  selectedPath: string | null;
  wipLimits: Record<string, number>;
  filters: BoardFilters;
  onMove: (activeId: string, overId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
}

export function Board({ board, today, selectedPath, wipLimits, filters, onMove, onAddCard }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space picks up / drops; Enter is left free for opening a focused card.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCard = activeId ? board.cards[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={(e: DragEndEvent) => {
        setActiveId(null);
        if (e.over) onMove(String(e.active.id), String(e.over.id));
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="mdkb-board">
        {board.config.columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            cardPaths={board.columns[col.id] ?? []}
            board={board}
            today={today}
            selectedPath={selectedPath}
            wipLimit={wipLimits[col.id]}
            filters={filters}
            onAddCard={onAddCard}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {activeCard ? (
          <div
            className="mdkb-card mdkb-card-overlay"
            data-prio={
              typeof activeCard.frontmatter.priority === "string" && activeCard.frontmatter.priority
                ? priorityTone(activeCard.frontmatter.priority)
                : undefined
            }
          >
            <div className="mdkb-card-main">
              <div className="mdkb-card-title">{activeCard.basename}</div>
              {(() => {
                const chips = cardChips(activeCard, today);
                return chips.length > 0 ? (
                  <div className="mdkb-chips">
                    {chips.map((c) => (
                      <span key={c.key} className={`mdkb-chip mdkb-chip-${c.tone}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
