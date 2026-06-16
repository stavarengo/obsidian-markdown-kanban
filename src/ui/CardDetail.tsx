import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Board, CardBody } from "../model/types";
import { DETAIL_WIDTH_MAX, DETAIL_WIDTH_MIN } from "../settings";
import { useBoardActions, useRepo, useSettings, useSettingsUpdater } from "./context";
import { Icon } from "./icons";

/** How the detail panel is presented; App decides where to mount it. */
export type DetailMode = "split" | "float" | "modal";

interface Props {
  path: string;
  board: Board;
  mode: DetailMode;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onChanged: () => void;
}

const clampWidth = (n: number) => Math.min(DETAIL_WIDTH_MAX, Math.max(DETAIL_WIDTH_MIN, n));

/** One editable custom-frontmatter row: local draft committed on blur/Enter, remove button. */
function PropRow({ name, value, onCommit, onRemove }: { name: string; value: string; onCommit: (v: string) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState(value);
  // Resync when the persisted value changes (e.g. after reload) and no edit is mid-flight.
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return (
    <div className="mdkb-prop-row">
      <span className="mdkb-prop-key">{name}</span>
      <input
        className="mdkb-prop-input"
        value={draft}
        aria-label={`Value of ${name}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      />
      <button className="mdkb-icon-btn mdkb-mini" aria-label={`Remove ${name}`} title="Remove property" onClick={onRemove}><Icon name="close" size={13} /></button>
    </div>
  );
}

/** One comment with inline edit + delete. Keeps the timestamp; edit commits on Enter/blur. */
function CommentItem({ timestamp, text, onSave, onDelete }: { timestamp: string; text: string; onSave: (v: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== text) onSave(draft.trim());
  };
  return (
    <li>
      <span className="mdkb-ts">{timestamp}</span>
      {editing ? (
        <textarea
          className="mdkb-comment-edit"
          value={draft}
          autoFocus
          aria-label="Edit comment"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } }}
        />
      ) : (
        <span className="mdkb-comment-row">
          <span className="mdkb-comment-text">{text}</span>
          <button className="mdkb-icon-btn mdkb-mini" aria-label="Edit comment" title="Edit" onClick={() => { setDraft(text); setEditing(true); }}><Icon name="pencil" size={13} /></button>
          <button className="mdkb-icon-btn mdkb-mini" aria-label="Delete comment" title="Delete" onClick={onDelete}><Icon name="trash" size={13} /></button>
        </span>
      )}
    </li>
  );
}

function resolveBasename(board: Board, link: string): string | null {
  for (const p in board.cards) if (board.cards[p].basename === link) return p;
  return null;
}

const WORD_SCALE = ["urgent", "high", "medium", "low"];
const LETTER_SCALE = ["A", "B", "C", "D"];
const EDITED_KEYS = new Set(["status", "priority", "due", "order", "type", "created"]);

/** Priority options that always include the card's current value (keeps arbitrary scales working). */
function priorityOptions(current: string): string[] {
  const base = LETTER_SCALE.includes(current) ? LETTER_SCALE : WORD_SCALE;
  return current && !base.includes(current) ? [current, ...base] : base;
}

export function CardDetail({ path, board, mode, onClose, onNavigate, onChanged }: Props) {
  const repo = useRepo();
  const actions = useBoardActions();
  const settings = useSettings();
  const updateSettings = useSettingsUpdater();
  const card = board.cards[path];
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [body, setBody] = useState<CardBody | null>(null);
  const [descDraft, setDescDraft] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [newSubcard, setNewSubcard] = useState("");
  const [newComment, setNewComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropVal, setNewPropVal] = useState("");
  // Width override only while a resize drag is in flight; otherwise the panel reads settings.detailWidth.
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const isSide = mode !== "modal";
  const width = dragWidth ?? settings.detailWidth;

  const reload = async () => {
    try {
      const b = await repo.readBody(path);
      setBody(b);
      setDescDraft(b.description);
    } catch {
      onClose(); // card was deleted out from under us
    }
  };

  useEffect(() => {
    setBody(null);
    setConfirmDelete(false);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Dialog focus management: focus in on open, return focus to the opener on close.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => openerRef.current?.focus?.();
  }, []);

  // Side modes: a pointerdown outside the panel closes it — but not when it lands on another
  // card (that card's own open handler switches the detail), nor on a menu/context surface.
  // Modal mode closes via its backdrop instead (handled by App).
  useEffect(() => {
    if (!isSide) return;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mdkb-detail, .mdkb-card, .mdkb-menu, .mdkb-card-context")) return;
      // Commit any in-progress edit before closing: blurring fires the focused field's onBlur,
      // which initiates its repo write synchronously — so clicking away saves instead of discarding.
      const ae = document.activeElement as HTMLElement | null;
      if (ae && panelRef.current?.contains(ae) && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isSide, onClose]);

  // Drag the panel's left border to resize (side modes). Width is derived from the panel's own
  // right edge so it works whether the panel is a flex sibling (split) or right-docked (float).
  const onResizeStart = (e: PointerEvent) => {
    e.preventDefault();
    const right = panelRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    (e.target as Element).setPointerCapture(e.pointerId);
    let latest = clampWidth(right - e.clientX);
    const onMove = (ev: globalThis.PointerEvent) => {
      latest = clampWidth(right - ev.clientX);
      setDragWidth(latest);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setDragWidth(null);
      updateSettings({ detailWidth: latest });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const mutate = async (fn: () => Promise<unknown>) => {
    await fn();
    await reload();
    onChanged();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  const modeClass = mode === "float" ? " mdkb-detail--float" : mode === "modal" ? " mdkb-detail--modal" : "";
  const panelStyle = isSide ? { width, flex: `0 0 ${width}px` } : undefined;

  if (!card) {
    return (
      <aside className={"mdkb-detail" + modeClass} role="dialog" aria-modal={mode === "modal"} aria-label="Card not found" ref={panelRef} tabIndex={-1} onKeyDown={onKeyDown} style={panelStyle}>
        <header className="mdkb-detail-header">
          <span>Card not found</span>
          <button className="mdkb-icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </header>
      </aside>
    );
  }

  const fm = card.frontmatter;
  const curPriority = String(fm.priority ?? "");
  const extraProps = Object.entries(fm).filter(
    ([k, v]) => !EDITED_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean") && v !== "",
  );

  return (
    <aside
      className={"mdkb-detail" + modeClass}
      data-testid="card-detail"
      role="dialog"
      aria-modal={mode === "modal"}
      aria-label={card.basename}
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={panelStyle}
    >
      {isSide && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div className="mdkb-detail-resize" role="separator" aria-orientation="vertical" aria-label="Resize panel" onPointerDown={onResizeStart} />
      )}
      <header className="mdkb-detail-header">
        <h2 className="mdkb-detail-title">{card.basename}</h2>
        <div className="mdkb-row-actions">
          {actions.doneColumnId && fm.status !== actions.doneColumnId && (
            <button className="mdkb-icon-btn mdkb-action-done" aria-label="Mark done" title="Mark done" onClick={() => actions.complete(path)}>
              <Icon name="check-circle" />
            </button>
          )}
          <button className="mdkb-icon-btn" aria-label="Open note" title="Open note in Obsidian" onClick={() => void repo.openCard(path)}>
            <Icon name="external-link" />
          </button>
          <button className="mdkb-icon-btn mdkb-action-delete" aria-label="Delete card" title="Delete card" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" />
          </button>
          <button className="mdkb-icon-btn" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </header>

      {confirmDelete && (
        <div className="mdkb-detail-confirm" role="alertdialog" aria-label="Confirm delete">
          <span>Delete this card? The note moves to trash.</span>
          <div className="mdkb-row-actions">
            <button className="mdkb-btn mdkb-btn-danger" onClick={() => actions.remove(path)}>Delete</button>
            <button className="mdkb-btn" autoFocus onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mdkb-detail-body">
        <div className="mdkb-fields">
          <label>
            Status
            <select value={String(fm.status ?? "")} onChange={(e) => void mutate(() => repo.setFrontmatter(path, { status: e.target.value }))}>
              {board.config.columns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={curPriority} onChange={(e) => void mutate(() => repo.setFrontmatter(path, { priority: e.target.value }))}>
              <option value="">—</option>
              {priorityOptions(curPriority).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            Due
            <input type="date" value={String(fm.due ?? "")} onChange={(e) => void mutate(() => repo.setFrontmatter(path, { due: e.target.value }))} />
          </label>
        </div>

        <div className="mdkb-props">
          {extraProps.map(([k, v]) => (
            <PropRow
              key={k}
              name={k}
              value={String(v)}
              onCommit={(val) => void mutate(() => repo.setFrontmatter(path, { [k]: val }))}
              onRemove={() => void mutate(() => repo.unsetFrontmatterKey(path, k))}
            />
          ))}
          <div className="mdkb-prop-add">
            <input
              className="mdkb-prop-input"
              value={newPropKey}
              placeholder="property"
              aria-label="New property name"
              onChange={(e) => setNewPropKey(e.target.value)}
            />
            <input
              className="mdkb-prop-input"
              value={newPropVal}
              placeholder="value"
              aria-label="New property value"
              onChange={(e) => setNewPropVal(e.target.value)}
            />
            <button
              className="mdkb-btn"
              aria-label="Add property"
              disabled={!newPropKey.trim() || EDITED_KEYS.has(newPropKey.trim())}
              onClick={() => {
                const key = newPropKey.trim();
                if (!key || EDITED_KEYS.has(key)) return;
                void mutate(() => repo.setFrontmatter(path, { [key]: newPropVal }));
                setNewPropKey("");
                setNewPropVal("");
              }}
            >
              Add
            </button>
          </div>
        </div>

        <section className="mdkb-section">
          <h3>Description</h3>
          <textarea className="mdkb-desc" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} placeholder="Add a description…" />
          {body && descDraft !== body.description && (
            <div className="mdkb-row-actions">
              <button className="mdkb-btn mdkb-btn-primary" onClick={() => void mutate(() => repo.setDescription(path, descDraft))}>Save</button>
              <button className="mdkb-btn" onClick={() => setDescDraft(body.description)}>Revert</button>
            </div>
          )}
        </section>

        <section className="mdkb-section">
          <h3>Subtasks &amp; subcards</h3>
          <ul className="mdkb-subtasks">
            {body?.subtasks.map((s) => (
              <li key={s.index} className="mdkb-subtask">
                <input type="checkbox" checked={s.done} aria-label={`Toggle ${s.text}`} onChange={() => void mutate(() => repo.toggleSubtask(path, s.index, !s.done))} />
                {s.kind === "card" && s.link ? (
                  (() => {
                    const child = resolveBasename(board, s.link);
                    return child ? (
                      <button className="mdkb-link" onClick={() => onNavigate(child)}>
                        {s.link}
                      </button>
                    ) : (
                      <span className="mdkb-link-missing" title="No card with this name on the board">
                        {s.link}
                      </span>
                    );
                  })()
                ) : (
                  <span className={s.done ? "mdkb-done" : ""}>{s.text}</span>
                )}
                <button className="mdkb-icon-btn mdkb-mini" aria-label="Remove" title="Remove" onClick={() => void mutate(() => repo.removeSubtask(path, s.index))}><Icon name="close" size={13} /></button>
              </li>
            ))}
            {body && body.subtasks.length === 0 && <li className="mdkb-muted">No subtasks yet.</li>}
          </ul>
          <div className="mdkb-add-inline">
            <input
              value={newTodo}
              placeholder="Add a todo…"
              aria-label="Add a todo"
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTodo.trim()) {
                  void mutate(() => repo.addTodo(path, newTodo.trim()));
                  setNewTodo("");
                }
              }}
            />
          </div>
          <div className="mdkb-add-inline">
            <input
              value={newSubcard}
              placeholder="Add a subcard…"
              aria-label="Add a subcard"
              onChange={(e) => setNewSubcard(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSubcard.trim()) {
                  void mutate(() => repo.addSubcard(path, newSubcard.trim()));
                  setNewSubcard("");
                }
              }}
            />
          </div>
        </section>

        <section className="mdkb-section">
          <h3>Comments</h3>
          <ul className="mdkb-comments">
            {body?.comments.map((c, i) => (
              <CommentItem
                key={i}
                timestamp={c.timestamp}
                text={c.text}
                onSave={(val) => void mutate(() => repo.updateComment(path, i, val))}
                onDelete={() => void mutate(() => repo.removeComment(path, i))}
              />
            ))}
            {body && body.comments.length === 0 && <li className="mdkb-muted">No comments yet.</li>}
          </ul>
          <div className="mdkb-add-inline">
            <textarea
              value={newComment}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && newComment.trim()) {
                  e.preventDefault();
                  void mutate(() => repo.addComment(path, newComment.trim()));
                  setNewComment("");
                }
              }}
            />
          </div>
        </section>

        <section className="mdkb-section">
          <h3>History</h3>
          <ul className="mdkb-history">
            {body?.history.map((h, i) => (
              <li key={i}>
                <span className="mdkb-ts">{h.timestamp}</span>
                <span>{h.text}</span>
              </li>
            ))}
            {body && body.history.length === 0 && <li className="mdkb-muted">No history yet.</li>}
          </ul>
        </section>
      </div>
    </aside>
  );
}
