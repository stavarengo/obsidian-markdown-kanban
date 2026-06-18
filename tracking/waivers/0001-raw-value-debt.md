# Waiver: DS-FOUNDATION-SSOT-1 — Allowlisted raw-value debt in `src/`

| Field | Value |
| --- | --- |
| **Rule violated** | DS-FOUNDATION-SSOT-1 — *Tokens are the only source of styling values.* Raw color/shadow/font/spacing/radius/motion/opacity/z-index literals MUST NOT appear in consuming code outside the token-definition layer. Verified by the Raw-value detection category (`DS-PROCESS-CONFORMANCE-1` #2). |
| **Status** | `active` |
| **Owner** | @stavarengo |
| **Created date** | 2026-06-18 |
| **Expiry date** | 2026-12-31 |
| **Scope** | The **61** grandfathered findings enumerated in `scripts/raw-value-allowlist.json` — raw lengths, z-index values, rgba shadows, the `#fff`/monospace literals in `src/styles.css`, the `24px` in `src/ui/CardDetail.tsx`, and the 8 column hexes in `src/ui/columnColors.ts`. Nothing outside that allowlist. |

## Reason

This is a real, measured constraint, not convenience. Tokenizing the 61 allowlisted values means rewriting a 60+-site, single-author stylesheet (`src/styles.css`) by hand, with no visual-regression harness to catch drift (see `0003-visual-regression-automation.md`). On a solo repo that is a high-risk change disproportionate to the benefit *right now*. Crucially, the debt is already fenced: `scripts/audit-raw-values.mjs` + the allowlist form a **ratchet** — any NEW raw value fails `ds:check`, and the required token categories (`DS-FOUNDATION-CATEGORIES-5`: typography size/weight, z-index/layering, opacity) already have token homes, so there is a place for every value to land.

## Risk

**Low.** No new drift is possible — the ratchet rejects any raw value not already in the allowlist, and the file `src/styles.css` is provably untouched since the DS work began (conformance report §B). The only residual risk is that the existing 61 literals remain un-themable until migrated, i.e. they don't inherit host light/dark variation the way a semantic token would. No user-facing regression, no inconsistency growth.

## Exit plan

Migrate the allowlisted values onto the new typography / z-index / opacity (and spacing/radius/shadow) tokens in `tokens/source/*.tokens.json`, replacing each literal in `src/styles.css` / `columnColors.ts` / `CardDetail.tsx` with its token reference. Each migrated value is deleted from `scripts/raw-value-allowlist.json` (regenerate with `node scripts/audit-raw-values.mjs --update`). The waiver retires when the allowlist `findings` array reaches empty. Trigger: the next styling pass that touches `src/styles.css`, or the expiry date — whichever comes first.

## Replacement

The token homes under `tokens/source/*.tokens.json` (typography, zindex, opacity, spacing, radius, shadow, color) become the single source of truth for these values, consumed via token references per `DS-FOUNDATION-SSOT-1` / `DS-FOUNDATION-CATEGORIES-5`.
