# See AGENTS.md

Follow the instructions in `AGENTS.md`.

## ACACIA Portfolio Standard

This app is part of the ACACIA portfolio and must stay compliant with
`jospabloh/acacia-app-standard` (STANDARD.md for the rationale, CHECKLIST.md for
the compact list). Mission Control slug: `umbral` (not registered yet).

Status after the 2026-10-13 audit — ✅ meets · 🟡 partial · ❌ missing:

- ✅ 22 server-authoritative diffing (`resolveCaller` reads `User` fresh).
- 🟡 1 licence · 2 roles · 3 permissions · 4 RLS · 5 health · 10 login · 18 one
  tenant · 21 About · 23 nav · 25 signup code.
- ❌ 6 changelog script · 7 danger zone · 8 tickets→MC · 9 site page · 11 deploy
  scripts · 12 shared ThemeSwitcher · 13 smoke · 14 isolation · 15 bridge
  (`acaciaControl`) · 16 secrets · 17 MC registration · 19 lock rationales ·
  20 shared session + 48h reap · 24 tenant roles in CI · 26 function.meta.json ·
  28 privacy inventory · 29 shared shell · 30 update banner.
- N/A 27 `mario_style` (not used).

Last audited against the standard: 2026-10-13 — full audit, 30 modules, repo +
deployed schema (app `6ac6b6d5aaf0d858dd14a690`) + Mission Control DB (no `apps`
row for umbral). Fixed in this pass: the tenant-pointer write lock and the four
medium findings below. Everything else above is still open.

Last multi-tenant isolation audit: 2026-10-13 —
- **Fixed:** `User.data` had no `rls.write`, so any account could re-point its
  own `condominium_id` with `auth.updateMe` and act as its role in another
  condominium (the field description claimed a lock that did not exist). Now
  `rls.write: admin` on the `data` field.
- **Fixed:** `access.registerEvent` used `pass_id` / `unit_id` from the body
  without checking their condominium (a guard could burn another condominium's
  single-use passes); `occurred_at` no longer comes from the body.
- **Fixed:** public `access.verifyPass` returned visitor phone, ids and the
  condominium address to anyone with the link; ids and phone now only go to staff
  of that pass's condominium.
- **Fixed:** `account.listMembers` returned every member's email/phone to any
  member; now gated on `Miembros:ver`.
- **Fixed:** `delegateCondominium` to yourself left zero admins; `changeRole` /
  `removeMember` / `delegateCondominium` could touch a platform `admin`;
  `changeRole` accepted any role string; `requestDeletion` had no role gate.
- **Fixed:** `LegalAcceptance` is append-only (`update`/`delete: false`).
- **OPEN — User shape:** `User.jsonc` declares a custom field literally named
  `data`, so the live pointer is stored at `data.data.condominium_id` (proven:
  a filter on `data.data.condominium_id` matches the live user, one on
  `data.condominium_id` matches nothing). Likely effects: the
  `{{user.data.condominium_id}}` RLS templates resolve to nothing (fails closed;
  the UI works because it reads through service-role functions), and the
  functions' `{"data.condominium_id": …}` filters on `User` (member list,
  last-admin count) match nothing. The fix is the portfolio shape — top-level
  `condominium_id` / `unit_id` / `full_name` / `phone` with `rls.write` on the
  pointers — plus migrating the live rows; it needs its own change.
- **OPEN (low):** `issueInvoice` takes the attachment URL from the body;
  `requestInvoice` lets guard/committee send any payment's CFDI to any address;
  `approveMember` / `units` / `billing` store foreign ids (`unit_id`,
  `resident_user_id`, `supplier_id`, `applied_to_fee_id`) without checking their
  condominium; `permissions.set` does not validate role/key.
- **Not verified:** a session as a restricted user of a second condominium (only
  one user and one condominium exist live); that `auth.updateMe` is refused after
  the lock deploy (needs a non-admin session); that deployed functions match the
  repo (only schemas were compared).
- Live `Condominium` reads `billing_status: active` with `trial_end_at: null`;
  Mission Control cannot have written it (the app is not registered). Who set it
  is unknown.

Secrets last read back: never — the app reads no secrets yet (Module 16).
Security locks last checked for drift (Module 19): 2026-10-13 — deployed `rls`
blocks match the repo for all 19 entities; the only drift is that the deployed
`User` has `required: ["data"]`.
Privacy last checked (Module 28): 2026-10-13 — no `privacy/data-inventory.json`.
Terms acceptance (Module 28, rule 10): observing — enforcement date not set.
