# Waiver: DS-XXX — <short title>

> Copy this file to `tracking/waivers/DS-XXX-<slug>.md` and fill every field.
> A waiver with a missing **Owner**, **Expiry date**, or **Scope** is invalid (see `README.md`).

| Field | Value |
| --- | --- |
| **Rule violated** | DS-XXX (link or quote the design-system rule being waived) |
| **Status** | `active` \| `expired` \| `retired` |
| **Owner** | @stavarengo |
| **Created date** | YYYY-MM-DD |
| **Expiry date** | YYYY-MM-DD (required — no open-ended waivers) |
| **Scope** | Exact files / selectors / components this waiver covers. Narrow, not "the whole UI". |

## Reason

Why the violation exists. Must be a real constraint (platform limit, upstream bug, measured value), **not convenience**.

## Risk

What could go wrong while this waiver is live (visual drift, a11y regression, inconsistency). Who/what it affects.

## Exit plan

The concrete steps that retire this waiver, and the trigger (a fixed upstream version, a refactor, a token landing).

## Replacement

What replaces the waived treatment once resolved (the token, spec, or component that becomes the source of truth).
