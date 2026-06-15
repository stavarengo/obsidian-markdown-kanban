import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ColumnDef } from "../model/types";
import { useBoardActions } from "./context";
import { Icon } from "./icons";

const COLORS = ["#4c9aff", "#8fd14f", "#ffab00", "#9c8cff", "#ff5c5c", "#57d9a3", "#f78fb3", "#9aa0a6"];

interface Props {
  column: ColumnDef;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
}

export function ColumnMenu({ column, isFirst, isLast, onClose }: Props) {
  const a = useBoardActions();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(column.title);
  const [wip, setWip] = useState(column.limit != null ? String(column.limit) : "");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const commitName = () => {
    const t = name.trim();
    if (t && t !== column.title) a.renameColumn(column.id, t);
  };
  const commitWip = () => {
    const next = wip.trim() === "" ? null : Number(wip);
    const cur = column.limit ?? null;
    if (next !== cur) a.setColumnLimit(column.id, next);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="mdkb-menu" ref={ref} role="menu" aria-label={`Column: ${column.title}`} onKeyDown={onKeyDown}>
      <div className="mdkb-menu-field">
        <span className="mdkb-menu-label">Title</span>
        <input
          autoFocus
          value={name}
          aria-label="Rename column"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitName();
              onClose();
            }
          }}
          onBlur={commitName}
        />
      </div>

      <div className="mdkb-menu-field">
        <span className="mdkb-menu-label">Color</span>
        <div className="mdkb-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={"mdkb-swatch" + (column.color?.toLowerCase() === c.toLowerCase() ? " is-active" : "")}
              style={{ background: c }}
              aria-label={`Set color ${c}`}
              onClick={() => a.setColumnColor(column.id, c)}
            />
          ))}
          <button className="mdkb-swatch mdkb-swatch-none" aria-label="Clear color" title="No color" onClick={() => a.setColumnColor(column.id, null)}>
            <Icon name="close" size={11} />
          </button>
        </div>
      </div>

      <label className="mdkb-menu-field">
        <span className="mdkb-menu-label">WIP limit</span>
        <input
          type="number"
          min="0"
          value={wip}
          placeholder="none"
          aria-label="WIP limit"
          onChange={(e) => setWip(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitWip();
              onClose();
            }
          }}
          onBlur={commitWip}
        />
      </label>

      <div className="mdkb-menu-divider" />
      <button className="mdkb-menu-item" role="menuitem" disabled={isFirst} onClick={() => { a.moveColumn(column.id, -1); onClose(); }}>
        <Icon name="arrow-left" size={14} /> Move left
      </button>
      <button className="mdkb-menu-item" role="menuitem" disabled={isLast} onClick={() => { a.moveColumn(column.id, 1); onClose(); }}>
        <Icon name="arrow-right" size={14} /> Move right
      </button>

      <div className="mdkb-menu-divider" />
      {!confirmDel ? (
        <button className="mdkb-menu-item mdkb-menu-danger" role="menuitem" onClick={() => setConfirmDel(true)}>
          <Icon name="trash" size={14} /> Delete column
        </button>
      ) : (
        <div className="mdkb-menu-confirm">
          <span>Delete “{column.title}”? Its cards move to a neighbouring column.</span>
          <div className="mdkb-row-actions">
            <button className="mdkb-btn mdkb-btn-danger" onClick={() => { a.deleteColumn(column.id); onClose(); }}>Delete</button>
            <button className="mdkb-btn" autoFocus onClick={() => setConfirmDel(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
