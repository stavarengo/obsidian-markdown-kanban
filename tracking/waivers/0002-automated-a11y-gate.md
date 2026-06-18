# Waiver: DS-A11Y-* — No automated a11y gate; 32 documented gaps unremediated

| Field | Value |
| --- | --- |
| **Rule violated** | The **DS-A11Y-\*** Accessibility Baseline family (`spec.md` §5), enforced via the **Accessibility checks** conformance category (`DS-PROCESS-CONFORMANCE-1` #4). Specifically the gaps map to DS-A11Y-TARGET-10 (24–26px targets), DS-A11Y-DISCOVERABLE-4 (hover-only reveal), DS-A11Y-STATUS-8 (no busy/announce on async writes), DS-A11Y-MODAL-6 (`aria-modal` without focus trap / inert background), and DS-A11Y-LANDMARK-12 (no `<main>`/`<h1>`/named regions). |
| **Status** | `active` |
| **Owner** | @stavarengo |
| **Created date** | 2026-06-18 |
| **Expiry date** | 2026-09-30 |
| **Scope** | The **32** distinct gaps enumerated in `tracking/audits/accessibility-audit.md` (gap index by severity), and the absence of any automated a11y check — no `eslint` / `eslint-plugin-jsx-a11y`, no `jest-axe`/`axe-core`, no CI a11y gate, plus the dead `jsx-a11y` `eslint-disable` directives in `CardDetail.tsx`, `ColumnEditModal.tsx`, `App.tsx`. Limited to `src/ui/`. |

## Reason

The a11y *contracts* are real and documented — the per-component / per-pattern Accessibility sections capture the intended behavior, and a genuine baseline exists in code (keyboard DnD, focus management, roles/names, `:focus-visible`), so DoD item 11 is honestly MET. What is missing is (a) an automated enforcement toolchain and (b) remediation of the 32 gaps. Standing up an eslint + axe toolchain and burning down 32 fixes by severity is **product engineering work** that goes beyond the goal of this effort, which was to establish the design-system source of truth. Deferring it is a scope boundary, not convenience.

## Risk

**Medium.** The baseline is documented but unenforced, so a future change could silently regress an a11y contract (no gate catches it), and the high-severity gaps degrade real AT/keyboard users today: Gap 28 (no landmarks/`<h1>`), Gap 4 (combobox missing `aria-activedescendant`), Gaps 16/21 (false `aria-modal` — focus escapes the dialog into the board). The dead `jsx-a11y` disables mark known-but-live violations that suppress nothing.

## Exit plan

1. Wire an automated a11y check proportionate to a solo repo — `eslint` + `eslint-plugin-jsx-a11y` (which also reactivates the existing dead `eslint-disable` directives), optionally `jest-axe` over the vitest UI suite — and run it under `ds:check` / the CI gate (`DS-PROCESS-CONFORMANCE-3`).
2. Burn down the 32 gaps **by severity**: High (28, 4, 16/21) first, then Medium, then Low/polish.
Retire the waiver when the gate is live and the High + Medium gaps are closed (Low/polish may roll into a follow-up). Trigger: the expiry date or the next a11y-focused work block.

## Replacement

The per-component and per-pattern **Accessibility contracts** in `docs/design-system/components/` and `docs/design-system/patterns/` become the enforced source of truth, with the automated a11y check as the conformance mechanism for `DS-PROCESS-CONFORMANCE-1` #4.
