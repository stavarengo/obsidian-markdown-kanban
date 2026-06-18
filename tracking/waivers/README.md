# Design-system waivers

This folder is the home for **tracked raw-value / style debt** — every deliberate, temporary deviation from the design-system standard (a bare colour, an inline `style=` that should be a token, an unspecced variant, an a11y shortcut). If a deviation is not recorded here, it is not approved; it is just drift.

Use `_template.md` to open a new waiver. One file per waiver, named `DS-XXX-<slug>.md`.

## Rules

1. **No waiver without an owner.** Every waiver names a responsible `@owner`.
2. **No waiver without an expiry.** Open-ended waivers are forbidden; pick a real date or trigger.
3. **No waiver without a scope.** State exactly what it covers (files, selectors, components). No blanket waivers.
4. **No waiver for convenience.** A waiver documents a *constraint*, not "I didn't feel like making a token". If you could do it right now, do it right.
5. **CI reports active + expired waivers.** `ds:check` enumerates this folder and prints the active and expired sets.
6. **Expired waivers block merge.** An expired (or invalid: missing owner / expiry / scope) waiver fails the check and blocks merge, **unless** an explicit, logged override is given by the owner.

## Lifecycle

`active` → (expiry passes) `expired` → either renewed with a new expiry + fresh justification, or resolved via its **Exit plan** and marked `retired`. Resolve waivers by landing the **Replacement**; don't let them silently lapse.
