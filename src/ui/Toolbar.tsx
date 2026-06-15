import { forwardRef } from "react";
import { Icon } from "./icons";
import type { BoardFilters, DueFilter } from "./cardView";
import { hasActiveFilter } from "./cardView";

interface Props {
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  matchCount: number;
  totalCount: number;
}

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(
  { filters, onChange, matchCount, totalCount },
  ref,
) {
  const active = hasActiveFilter(filters);
  const setText = (text: string) => onChange({ ...filters, text });
  const toggleDue = (due: DueFilter) => onChange({ ...filters, due: filters.due === due ? "" : due });

  return (
    <div className="mdkb-toolbar">
      <div className="mdkb-search">
        <Icon name="search" size={15} />
        <input
          ref={ref}
          type="text"
          value={filters.text}
          placeholder="Search cards…  (press /)"
          aria-label="Search cards"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (filters.text) {
                e.stopPropagation();
                setText("");
              } else {
                (e.target as HTMLInputElement).blur();
              }
            }
          }}
        />
        {filters.text && (
          <button className="mdkb-icon-btn mdkb-mini" aria-label="Clear search" title="Clear" onClick={() => setText("")}>
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      <div className="mdkb-toolbar-filters" role="group" aria-label="Quick filters">
        <button
          className={"mdkb-filter-chip" + (filters.due === "overdue" ? " is-on" : "")}
          aria-pressed={filters.due === "overdue"}
          onClick={() => toggleDue("overdue")}
        >
          <Icon name="alert" size={13} />
          Overdue
        </button>
        <button
          className={"mdkb-filter-chip" + (filters.due === "soon" ? " is-on" : "")}
          aria-pressed={filters.due === "soon"}
          onClick={() => toggleDue("soon")}
        >
          <Icon name="calendar" size={13} />
          Due soon
        </button>
      </div>

      {active && (
        <div className="mdkb-toolbar-status" aria-live="polite">
          <span>
            {matchCount} of {totalCount}
          </span>
          <button className="mdkb-btn" onClick={() => onChange({ text: "", due: "" })}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
});
