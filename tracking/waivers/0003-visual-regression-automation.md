# Waiver: DS-PROCESS-CONFORMANCE-1 #5 — No automated visual-regression harness

| Field | Value |
| --- | --- |
| **Rule violated** | **DS-PROCESS-CONFORMANCE-1**, conformance category **#5 "Visual regression"** — *visual output is protected against unintended change.* (No dedicated `DS-VISUAL-*` rule exists; this is the category that mandates the check.) Justified under **DS-PROCESS-CONFORMANCE-4 — Proportionate enforcement**, which requires the category be enforced but lets the *mechanism* be chosen for proportionality. |
| **Status** | `active` |
| **Owner** | @stavarengo |
| **Created date** | 2026-06-18 |
| **Expiry date** | 2027-06-18 (review) |
| **Scope** | The absence of an automated screenshot / pixel-diff visual-regression harness for the plugin UI. Limited to the visual-regression conformance category; all other categories (token validation, raw-value detection, spec coverage, a11y) are unaffected. |

## Reason

A real platform constraint, not convenience. There is no Storybook or standalone component-preview harness, and an Obsidian plugin renders only inside the host app — UI is previewed through the `examples/` vault, not an isolated story runner. Standing up a pixel-diff harness (headless host, snapshot baselines, flake management) is disproportionate for a solo repo. Per `DS-PROCESS-CONFORMANCE-4` the category is still *enforced*, just by a proportionate mechanism rather than the heaviest tool: the no-regression proof for the DS work is **structural** — `src/styles.css` is provably untouched and the only source change is a value-preserving 8-color palette dedup (conformance report §B).

## Risk

**Low.** Styling is centralized in one `src/styles.css`, the token drift-check (`tokens:check`) guards the token↔consumer mapping, the raw-value ratchet blocks new literals, and the vitest UI suite (`test/ui.test.tsx`, 76 tests) regression-guards role/state/variant surface. The residual risk is that a *rendered-pixel* change (not a structural/token change) could slip through without a screenshot baseline — mitigated by manual review through the examples vault until a preview harness exists.

## Exit plan

Re-evaluate at expiry, or sooner if a component-preview harness (Storybook or equivalent) is adopted for the plugin — at which point adding a screenshot/pixel-diff stage under `ds:check` / CI becomes proportionate. If still no harness at review, renew with fresh justification or formally accept structural+manual proof as the standing mechanism for this category under `DS-PROCESS-CONFORMANCE-4`.

## Replacement

The proportionate mechanism that stands in until (and unless) a harness lands: the **token drift-check** (`tokens:check`) + the **`examples/` vault** for manual visual review + the **vitest UI test suite**. These collectively satisfy `DS-PROCESS-CONFORMANCE-1` #5 at a cost proportionate to a solo repo.
