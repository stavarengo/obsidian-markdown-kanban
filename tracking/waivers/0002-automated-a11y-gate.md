# Waiver: DS-A11Y-* — No automated a11y gate; 32 documented gaps unremediated

| Field | Value |
| --- | --- |
| **Rule violated** | The **DS-A11Y-\*** Accessibility Baseline family (`spec.md` §5), enforced via the **Accessibility checks** conformance category (`DS-PROCESS-CONFORMANCE-1` #4). Specifically the gaps map to DS-A11Y-TARGET-10 (24–26px targets), DS-A11Y-DISCOVERABLE-4 (hover-only reveal), DS-A11Y-STATUS-8 (no busy/announce on async writes), DS-A11Y-MODAL-6 (`aria-modal` without focus trap / inert background), and DS-A11Y-LANDMARK-12 (no `<main>`/`<h1>`/named regions). |
| **Status** | `retired` |
| **Owner** | @stavarengo |
| **Created date** | 2026-06-18 |
| **Expiry date** | 2026-09-30 |
| **Scope** | The **32** distinct gaps enumerated in `tracking/audits/accessibility-audit.md` (gap index by severity), and the absence of any automated a11y check — no `eslint` / `eslint-plugin-jsx-a11y`, no `jest-axe`/`axe-core`, no CI a11y gate, plus the dead `jsx-a11y` `eslint-disable` directives in `CardDetail.tsx`, `ColumnEditModal.tsx`, `App.tsx`. Limited to `src/ui/`. |

## Reason

The a11y *contracts* were always real and documented — the per-component / per-pattern Accessibility sections capture the intended behavior, and a genuine baseline exists in code (keyboard DnD, focus management, roles/names, `:focus-visible`), so DoD item 11 was honestly MET. What was missing — (a) an automated enforcement toolchain and (b) remediation of the documented gaps — has now been delivered, so this waiver is retired.

## Risk

**Resolved.** The baseline is now enforced by an automated gate, so a change that regresses an a11y contract is caught rather than landing silently. The high-severity gaps are closed: landmarks and `<h1>`/named regions are in place (board `role=region`, toolbar `role=search`, column-count badge `role=img`), and the dialogs use `div role=dialog` panels — fixing the prior false `aria-modal`, region, `aria-prohibited-attr`, `aria-allowed-role`, and banner-landmark findings. The dead `jsx-a11y` disables were removed; the few remaining disables are justified (dnd-spread / dialog-keyboard false positives).

## Resolution

The automated a11y gate is installed and enforced. It is **two-layered**:

- **Static** — `eslint` + `eslint-plugin-jsx-a11y`, exposed as the `lint:a11y` script.
- **Runtime** — `vitest-axe` over the UI suite, exposed as the `test:a11y` script.

Both layers run under `ds:check` and the `lefthook` pre-commit/pre-push hooks, so the gate blocks regressions locally and in CI. The historical gaps are resolved: axe reports **0 serious/critical** violations; the 8 jsx-a11y interaction violations were fixed (1 real focus fix + justified disables for the dnd-spread / dialog-keyboard false positives); landmarks and dialog roles were added; and the dead `eslint-disable` directives were removed.

**Single residual (not a blocker):** `color-contrast`. jsdom cannot compute rendered colors, so axe cannot evaluate this rule in the unit-test environment. It is deferred to a future real-browser / Lighthouse audit. This is a measurement-environment limitation, not an unenforced contract — every rule jsdom *can* evaluate passes clean.

## Replacement

The per-component and per-pattern **Accessibility contracts** in `docs/design-system/components/` and `docs/design-system/patterns/` are the enforced source of truth, with the two-layer automated a11y gate (`lint:a11y` + `test:a11y`, run under `ds:check` / `lefthook`) as the conformance mechanism for `DS-PROCESS-CONFORMANCE-1` #4.
