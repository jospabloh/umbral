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
- ✅ 15 bridge **implemented in the repo, NOT live** (see below).
- ❌ 6 changelog script · 7 danger zone · 8 tickets→MC · 9 site page · 11 deploy
  scripts · 12 shared ThemeSwitcher · 13 smoke · 14 isolation · 16 secrets · 17 MC registration · 19 lock rationales ·
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
- **Fixed 2026-10-14 — User shape:** `User.jsonc` used to declare a custom
  field literally named `data`, so the pointer was stored at
  `data.data.condominium_id` (proven live: a filter on `data.data.condominium_id`
  matched the user, one on `data.condominium_id` matched nothing). The
  `{{user.data.condominium_id}}` RLS rules therefore saw nothing, and the
  functions' `"data.condominium_id"` filters on `User` (member list, last-admin
  count) matched nothing. Now `condominium_id`, `unit_id` and `phone` are
  top-level custom fields (the StockFlow shape), both pointers with
  `rls.write: admin`; the name is the built-in `full_name`. `resolveCaller` /
  `readUser` copy the legacy object once and set `legacy_migrated_at` (also
  locked) — the mark is what stops a removed member from being copied back in.
  The legacy `data` field stays declared and locked until no record needs it;
  removing it is a later change. Only an account's own request persists its
  migration (`readUser` on other ids is read-only), a failed migration write
  lets the request proceed on the migrated view, and `removeMember` empties the
  legacy object. Symptom to recognise: a second condo_admin who has not made a
  request since the deploy is not yet counted by the last-admin check, so
  removing/deleting the other admin is refused until they log in once.
  Residual race, accepted: if a member's very first request after the deploy
  runs concurrently with their own removal, the in-flight migration can write
  the old condominium back after the removal. One request per account for
  life; `removeMember` setting the mark narrows it but cannot close it without
  a conditional update, which Base44 does not offer.
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
`User` has `required: ["data"]`. 2026-10-14: cause found — when an entity file
omits `required`, Base44's sync marks EVERY property required (after the User
reshape it deployed `required: [condominium_id, unit_id, phone,
legacy_migrated_at, data]`, which can refuse a signup that carries none of
them). `User.jsonc` now declares `"required": []`, as StockFlow's does; every
entity file must declare `required` explicitly.
Migration verified live 2026-10-14: the one user has top-level
`condominium_id`, `legacy_migrated_at` = 2026-10-14T03:46:34Z, and a filter on
`data.condominium_id` (the path `{{user.data.condominium_id}}` reads) now
matches it — it matched nothing before.
Privacy last checked (Module 28): 2026-10-13 — no `privacy/data-inventory.json`.
Terms acceptance (Module 28, rule 10): observing — enforcement date not set.

## Module 15 — bridge to Mission Control (implemented in repo 2026-10-14, NOT deployed)

`base44/functions/acaciaControl/` (`entry.ts`, `_bridge_logic.ts`, `_acaciaSign.ts`
= byte-identical copy of the standard's `shared/bridge/acaciaSign.ts`) mirrors
Sommel's bridge. Tests: `base44/functions/acaciaSign.test.ts` and
`base44/tests/bridge_test.ts` (`deno test --allow-env`). Outbound pings to MC
(`ticket-pull`, `tenant-pull`) go through `base44/shared/mcPing.ts`. Schema:
`Condominium.license_expires_at` / `license_plan` (write-locked to admin),
`SupportTicket.created_by_email`. None of this is deployed or registered in MC.

**Secrets to set in Base44 BEFORE registering `umbral` in Mission Control:**
- `INGEST_HMAC_SECRET` — copy of the portfolio value (never a new one).
- `ACACIA_APP_SLUG` = `umbral` (must equal `apps.id`; read it back, Module 16).
- `PLATFORM_OWNER_EMAIL` — receives the copy of every follow-up sent to a tenant.
- `APP_SUPPORT_EMAIL` — optional; extra allowed recipient for internal notices.

Until they are set `acaciaControl` answers **503 `bridge_not_configured`** to
every call. That is the intended fail-closed state, not an outage. Deploying the
schema and functions, registering the app in MC (Module 17: `apps` row,
`licenseControl.js`, `ticketControl.js`, `messaging.js`, client catalogue) and a
sync with zero `rejected the derived key` warnings are still to do.
