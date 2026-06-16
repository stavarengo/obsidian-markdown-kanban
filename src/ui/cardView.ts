// Pure helpers that turn a card's data into the little chips shown on its board card.
// Backward-compatible across vaults: priority may be a letter scale (A/B/C/D) or a word
// scale (urgent/high/medium/low) — both map to the same four severity tones.
import type { Card } from "../model/types";
import type { IconName } from "./icons";

export type ChipTone =
  | "prio-1"
  | "prio-2"
  | "prio-3"
  | "prio-4"
  | "danger"
  | "warn"
  | "accent"
  | "muted";

export interface CardChip {
  key: string;
  label: string;
  tone: ChipTone;
  icon?: IconName;
  title?: string;
}

const PRIORITY_TONE: Record<string, ChipTone> = {
  // letter scale
  a: "prio-1",
  b: "prio-2",
  c: "prio-3",
  d: "prio-4",
  // word scale
  urgent: "prio-1",
  highest: "prio-1",
  high: "prio-1",
  p0: "prio-1",
  p1: "prio-1",
  medium: "prio-2",
  med: "prio-2",
  normal: "prio-2",
  p2: "prio-2",
  low: "prio-3",
  p3: "prio-3",
  lowest: "prio-4",
  trivial: "prio-4",
  p4: "prio-4",
};

export function priorityTone(value: string): ChipTone {
  return PRIORITY_TONE[value.trim().toLowerCase()] ?? "muted";
}

const PRIORITY_WORD_SCALE = ["urgent", "high", "medium", "low"];
const PRIORITY_LETTER_SCALE = ["A", "B", "C", "D"];

/** Priority options that always include the card's current value (keeps arbitrary scales working). */
export function priorityOptions(current: string): string[] {
  const base = PRIORITY_LETTER_SCALE.includes(current) ? PRIORITY_LETTER_SCALE : PRIORITY_WORD_SCALE;
  return current && !base.includes(current) ? [current, ...base] : base;
}

/** Whole-day difference (target − today), both as YYYY-MM-DD. */
function dayDelta(target: string, today: string): number | null {
  const t = Date.parse(target + "T00:00:00");
  const n = Date.parse(today + "T00:00:00");
  if (Number.isNaN(t) || Number.isNaN(n)) return null;
  return Math.round((t - n) / 86_400_000);
}

export type DueUrgency = "overdue" | "today" | "soon" | "future" | "done";

export interface DueInfo {
  label: string;
  urgency: DueUrgency;
}

/** Human, scannable due label + urgency. Quick-scan friendly: "Today", "Tomorrow", "in 3d", "2d ago". */
export function dueInfo(due: string, today: string, done: boolean): DueInfo {
  const delta = dayDelta(due, today);
  if (delta === null) return { label: due, urgency: done ? "done" : "future" };
  if (done) return { label: due, urgency: "done" };
  if (delta < 0) {
    const d = -delta;
    return { label: d === 1 ? "Yesterday" : `${d}d ago`, urgency: "overdue" };
  }
  if (delta === 0) return { label: "Today", urgency: "today" };
  if (delta === 1) return { label: "Tomorrow", urgency: "soon" };
  if (delta <= 3) return { label: `in ${delta}d`, urgency: "soon" };
  if (delta <= 7) return { label: `in ${delta}d`, urgency: "future" };
  return { label: due.slice(5), urgency: "future" }; // MM-DD for far-out dates
}

export function tagValues(card: Card): string[] {
  const fm = card.frontmatter;
  const out: string[] = [];
  if (typeof fm.area === "string" && fm.area) out.push(fm.area);
  if (Array.isArray(fm.tags)) {
    for (const t of fm.tags) if (typeof t === "string" && t) out.push(t);
  } else if (typeof fm.tags === "string" && fm.tags) {
    out.push(fm.tags);
  }
  return out;
}

export type DueFilter = "" | "overdue" | "soon";

export interface BoardFilters {
  text: string;
  due: DueFilter;
}

export const EMPTY_FILTERS: BoardFilters = { text: "", due: "" };

export function hasActiveFilter(f: BoardFilters): boolean {
  return f.text.trim() !== "" || f.due !== "";
}

// ---------------------------------------------------------------------------
// Filter grammar — a reusable string-query language shared by the search toolbar
// (#9) and area-scoped / auto-populated columns (#1).
//
// A query is a space-separated list of terms. A term is either a `key:value` token
// (area:, status:, priority:, tag:, due:, context:) or free text. Free text is matched
// case-insensitively against a card's basename + priority + tags (a Card has no body
// text at board level, so "free text" means title/priority/tags). Use "double quotes"
// to allow spaces in a value or a free-text phrase. All terms AND together; an empty
// query matches every card. The grammar never throws — unknown keys fall back to free text.
// ---------------------------------------------------------------------------

/** Token keys the grammar understands. Free text is held separately. */
export type FilterKey = "area" | "status" | "priority" | "tag" | "due" | "context";

const FILTER_KEYS: readonly FilterKey[] = ["area", "status", "priority", "tag", "due", "context"];

/** Recognized `due:` values. A bare YYYY-MM-DD date is also accepted (exact match). */
export type DueToken = "overdue" | "soon" | "today" | "none";

export interface FilterToken {
  key: FilterKey;
  /** Lower-cased value as written after the colon. */
  value: string;
}

export interface Filter {
  /** Free-text terms (lower-cased); each must be found in the haystack. */
  text: string[];
  /** `key:value` tokens, ANDed together. */
  tokens: FilterToken[];
}

/** Extra context the matcher needs that isn't on the card (for `due:` urgency). */
export interface MatchContext {
  /** Today as YYYY-MM-DD. */
  today: string;
  /** Resolved id of the board's "done" column, or null. */
  doneColumnId: string | null;
}

export const EMPTY_FILTER: Filter = { text: [], tokens: [] };

function isFilterKey(s: string): s is FilterKey {
  return (FILTER_KEYS as readonly string[]).includes(s);
}

/**
 * Split a query into terms, honoring "double quotes" so a value (or a free-text phrase) can
 * contain spaces. A quoted run may carry a `key:` prefix glued to it (`area:"garden prep"`),
 * which is kept attached so the whole thing parses as one `key:value` token. Quotes are stripped
 * from the value; the optional key prefix is preserved.
 */
function tokenizeQuery(query: string): string[] {
  const out: string[] = [];
  // Either: an optional non-space prefix immediately before a "quoted run"; or an unquoted run.
  const re = /(\S*?)"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    if (m[2] !== undefined) out.push(m[1] + m[2]); // prefix (maybe "key:") + unquoted value
    else out.push(m[3]);
  }
  return out;
}

/** Parse a query string into a structured Filter. Never throws. */
export function parseFilter(query: string): Filter {
  const text: string[] = [];
  const tokens: FilterToken[] = [];
  for (const term of tokenizeQuery(query)) {
    const colon = term.indexOf(":");
    if (colon > 0) {
      const rawKey = term.slice(0, colon).toLowerCase();
      const value = term.slice(colon + 1).trim().toLowerCase();
      if (isFilterKey(rawKey) && value !== "") {
        tokens.push({ key: rawKey, value });
        continue;
      }
    }
    const t = term.trim().toLowerCase();
    if (t !== "") text.push(t);
  }
  return { text, tokens };
}

/** True when the filter has no terms (matches everything). */
export function isEmptyFilter(f: Filter): boolean {
  return f.text.length === 0 && f.tokens.length === 0;
}

/** Lower-cased free-text haystack: basename + priority + tags (area + tags). */
function freeTextHaystack(card: Card): string {
  return [card.basename, String(card.frontmatter.priority ?? ""), ...tagValues(card)].join(" ").toLowerCase();
}

/** All lower-cased entries of a frontmatter value that may be a string or string[]. */
function listValues(value: unknown): string[] {
  if (typeof value === "string") return value ? [value.toLowerCase()] : [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase());
  return [];
}

/**
 * `due:` matching. Delegates to `dueInfo` so urgency buckets stay identical to the chip and
 * the legacy filter (done cards are never "overdue"). `soon` is cumulative (soon-or-sooner);
 * `today`/`overdue` are exact; `none` = no due date; an explicit YYYY-MM-DD matches that date.
 */
function matchDue(card: Card, value: string, ctx: MatchContext): boolean {
  const due = card.frontmatter.due;
  const has = typeof due === "string" && due !== "";
  if (value === "none") return !has;
  if (!has) return false;
  const u = dueInfo(due, ctx.today, card.frontmatter.status === ctx.doneColumnId).urgency;
  switch (value) {
    case "overdue":
      return u === "overdue";
    case "today":
      return u === "today";
    case "soon":
      return u === "overdue" || u === "today" || u === "soon";
    default:
      return due.toLowerCase() === value;
  }
}

function matchToken(card: Card, token: FilterToken, ctx: MatchContext): boolean {
  const fm = card.frontmatter;
  switch (token.key) {
    case "area":
      return String(fm.area ?? "").toLowerCase() === token.value;
    case "status":
      return String(fm.status ?? "").toLowerCase() === token.value;
    case "priority":
      return String(fm.priority ?? "").toLowerCase() === token.value;
    case "tag":
      return tagValues(card).some((t) => t.toLowerCase() === token.value);
    case "context":
      // #14: a card's context is the folder-derived `card.context` (path-based, the primary
      // source) OR any entry of its `context` frontmatter (string | string[]). Matching both keeps
      // §1/§9/§14 on one notion of context so the filter token stays truthful for folder contexts.
      return (
        (typeof card.context === "string" && card.context.toLowerCase() === token.value) ||
        listValues(fm.context).includes(token.value)
      );
    case "due":
      return matchDue(card, token.value, ctx);
  }
}

/** Pure predicate: does a card satisfy every term of the parsed filter? */
export function matchCard(card: Card, filter: Filter, ctx: MatchContext): boolean {
  if (filter.text.length) {
    const hay = freeTextHaystack(card);
    for (const t of filter.text) if (!hay.includes(t)) return false;
  }
  for (const token of filter.tokens) if (!matchToken(card, token, ctx)) return false;
  return true;
}

/** Convenience: parse + match in one call (e.g. a one-off area-scoped column rule). */
export function matchQuery(card: Card, query: string, ctx: MatchContext): boolean {
  return matchCard(card, parseFilter(query), ctx);
}

/**
 * Pure predicate: does a card pass the legacy search text + due filter?
 * Preserved as a thin superset over `matchCard`. The legacy `text` is treated as ONE free-text
 * term (it is NOT re-parsed through `parseFilter`, so a colon in the search box keeps matching
 * literally instead of becoming a token). The `due` field maps to a `due:` token.
 */
export function cardMatches(card: Card, today: string, f: BoardFilters, doneColumnId: string | null): boolean {
  const q = f.text.trim().toLowerCase();
  const filter: Filter = {
    text: q ? [q] : [],
    tokens: f.due ? [{ key: "due", value: f.due }] : [],
  };
  return matchCard(card, filter, { today, doneColumnId });
}

export function cardChips(card: Card, today: string, doneColumnId: string | null): CardChip[] {
  const fm = card.frontmatter;
  const chips: CardChip[] = [];

  if (typeof fm.priority === "string" && fm.priority) {
    chips.push({ key: "prio", label: fm.priority, tone: priorityTone(fm.priority), title: "Priority" });
  }
  for (const [i, tag] of tagValues(card).entries()) {
    chips.push({ key: "tag-" + i, label: tag, tone: "muted", title: "Tag" });
  }
  if (typeof fm.due === "string" && fm.due) {
    const done = fm.status === doneColumnId;
    const info = dueInfo(fm.due, today, done);
    const tone: ChipTone =
      info.urgency === "overdue" ? "danger" : info.urgency === "today" || info.urgency === "soon" ? "warn" : "muted";
    chips.push({
      key: "due",
      label: info.label,
      tone,
      icon: info.urgency === "overdue" ? "alert" : "calendar",
      title: "Due " + fm.due,
    });
  }

  return chips;
}
