import { useState } from "react";
import { useBoardActions } from "./context";
import { Icon } from "./icons";

export function AddColumn() {
  const a = useBoardActions();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const t = title.trim();
    if (t) a.addColumn(t);
    setTitle("");
    setAdding(false);
  };

  if (!adding) {
    return (
      <button className="mdkb-add-column" aria-label="Add column" onClick={() => setAdding(true)}>
        <Icon name="plus" size={16} />
        Add column
      </button>
    );
  }

  return (
    <div className="mdkb-add-column is-editing">
      <input
        autoFocus
        value={title}
        placeholder="Column name…"
        aria-label="New column name"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") {
            setAdding(false);
            setTitle("");
          }
        }}
      />
      <div className="mdkb-row-actions">
        <button className="mdkb-btn mdkb-btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={submit}>
          Add
        </button>
        <button className="mdkb-btn" onClick={() => { setAdding(false); setTitle(""); }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
