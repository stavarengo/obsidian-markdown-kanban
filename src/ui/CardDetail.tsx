import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Board, CardBody } from "../model/types";
import { DETAIL_WIDTH_MAX, DETAIL_WIDTH_MIN } from "../settings";
import { priorityOptions } from "./cardView";
import { useBoardActions, useRepo, useSettings, useSettingsUpdater } from "./context";
import { Icon } from "./icons";

/** How the detail panel is presented; App decides where to mount it. */
export type DetailMode = "split" | "float" | "modal";

interface Props {
  path: string;
  board: Board;
  mode: DetailMode;
  onClose: () => void;
  /** Switch the panel to another card (subcard links). The create form never navigates. */
  onNavigate?: (path: string) => void;
  onChanged: () => void;
  /** When set, render the minimal CREATE form (new card in this column) instead of the card body. */
  createColumn?: string;
  /** Called with the new card's path after a successful create. */
  onCreated?: (path: string) => void;
  /** When set, focus the description textarea on mount (fresh card from an add-card flow). */
  focusNew?: boolean;
  /** When set, focus the "Add a subcard" input (the context-menu "Add subcard" action). */
  focusAddSubcard?: boolean;
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

const EDITED_KEYS = new Set(["status", "priority", "due", "order", "type", "created"]);

export function CardDetail({ path, board, mode, onClose, onNavigate, onChanged, createColumn, onCreated, focusNew, focusAddSubcard }: Props) {
  const repo = useRepo();
  const actions = useBoardActions();
  const settings = useSettings();
  const updateSettings = useSettingsUpdater();
  const card = board.cards[path];
  const isCreate = createColumn != null;
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const subcardRef = useRef<HTMLInputElement | null>(null);
  // Synchronous in-flight guard for the create form: blocks a second submit (rapid Enter, or
  // Enter-then-click) during the async createCard window before onCreated unmounts this branch.
  const creatingRef = useRef(false);
  const [body, setBody] = useState<CardBody | null>(null);
  const [descDraft, setDescDraft] = useState("");
  const [createTitle, setCreateTitle] = useState("");
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
    if (isCreate) return; // no card to read while the create form is up
    setBody(null);
    setConfirmDelete(false);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, isCreate]);

  // Dialog focus management: focus in on open, return focus to the opener on close. The create form
  // autofocuses its title input (a synchronous commit-phase focus), so don't steal it back here.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    if (!isCreate) panelRef.current?.focus();
    return () => openerRef.current?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A freshly-created card (inline-edit / detail flows) lands focus on the description, not the panel.
  // Keyed on `path`, not `body`, so each field edit's reload doesn't yank focus back. The detail
  // create flow unmounts the create branch and remounts a fresh card panel (focus lands via the
  // mount-time effect); inline-edit re-keys the same instance and re-fires this effect on the new path.
  useEffect(() => {
    if (focusNew && !isCreate) descRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNew, path]);

  // The "Add subcard" context-menu action opens this card and lands focus on its subcard input,
  // letting the user type the title there (the input's Enter handler calls repo.addSubcard).
  useEffect(() => {
    if (focusAddSubcard && !isCreate) subcardRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAddSubcard, path]);

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

  if (isCreate) {
    const columnTitle = board.config.columns.find((c) => c.id === createColumn)?.title ?? createColumn;
    const submitCreate = () => {
      const t = createTitle.trim();
      if (!t || creatingRef.current) return;
      creatingRef.current = true;
      void (async () => {
        try {
          const newPath = await repo.createCard(t, createColumn);
          onCreated?.(newPath);
          // On success this branch unmounts (createColumn→null), so no need to reset the guard.
        } catch {
          creatingRef.current = false; // let the user retry after a failed create
        }
      })();
    };
    return (
      <aside
        className={"mdkb-detail" + modeClass}
        data-testid="card-detail"
        role="dialog"
        aria-modal={mode === "modal"}
        aria-label={`New card in ${columnTitle}`}
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
          <h2 className="mdkb-detail-title">New card in {columnTitle}</h2>
          <div className="mdkb-row-actions">
            <button className="mdkb-icon-btn" aria-label="Close" title="Close (Esc)" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
        </header>
        <div className="mdkb-detail-body">
          <section className="mdkb-section">
            <label>
              Title
              <input
                className="mdkb-create-title"
                autoFocus
                value={createTitle}
                aria-label="New card title"
                placeholder="What needs doing?"
                onChange={(e) => setCreateTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createTitle.trim()) { e.preventDefault(); submitCreate(); }
                }}
              />
            </label>
            <div className="mdkb-row-actions">
              <button className="mdkb-btn mdkb-btn-primary" disabled={!createTitle.trim()} onClick={submitCreate}>Create</button>
              <button className="mdkb-btn" onClick={onClose}>Cancel</button>
            </div>
          </section>
        </div>
      </aside>
    );
  }

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
            <select value={curPriority} onChange={(e) => void mutate(() => e.target.value === "" ? repo.unsetFrontmatterKey(path, "priority") : repo.setFrontmatter(path, { priority: e.target.value }))}>
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
          <textarea ref={descRef} className="mdkb-desc" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} placeholder="Add a description…" />
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
                      <button className="mdkb-link" onClick={() => onNavigate?.(child)}>
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
              ref={subcardRef}
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
