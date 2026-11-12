# Nexmile HRMS — Runbook

Operational guide for the Nexmile Technology employee portal (HRMS), which is
part of the company website: marketing pages at `https://www.nexmiletechnology.com/`,
employee portal at **`/hrms`** (sign-in: **`/hrms/login`**, linked as
"Employee Login" in the site header). Data lives in the hosted Supabase
project **nexmile-hrms-dev** (ref `bgjohvtojkrdssrledrv`).

Code layout in this repository:

| Path | What |
| --- | --- |
| `src/app/(site)/` | marketing pages (header/footer from `(site)/layout.tsx`) |
| `src/app/hrms/` | HRMS routes (`(app)/` = signed-in portal, plus `login`, `access-pending`, `auth/callback`, document downloads) |
| `src/hrms/components`, `src/hrms/lib` | HRMS components, auth, data access (`@/hrms/...`) |
| `src/proxy.ts` | Supabase session refresh, matcher `/hrms` only (marketing pages stay static) |
| `database/` | migrations, rollbacks and tests |
| `src/app/globals.css` | site theme + HRMS tokens scoped under `.hrms` |

> Employee and payroll records in the dev project are **synthetic
> demonstration data**. Payroll amounts are entered manually; the system does
> **not** calculate PF, ESI, professional tax or TDS and is not a verified
> statutory payroll engine.

---

## 1. Environment setup

Requirements: Node.js 20+, npm. No Docker, no local database, no Supabase CLI
local stack.

```bash
npm install
# create .env.local with the two variables below, then:
npm run dev                        # site: http://localhost:3000, portal: http://localhost:3000/hrms/login
```

`.env.local` (never commit it; `.env*` is git-ignored):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bgjohvtojkrdssrledrv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the project's **publishable** key (Dashboard → Project Settings → API Keys) |

Rules:

- Only the URL and the publishable key are used. **Never** put a service-role
  or `sb_secret_…` key in this app; `src/hrms/lib/supabase/env.ts` refuses to start if
  one is pasted into the public variable.
- All data protection is in the database (RLS + `app_private` functions).

Checks before every commit / deploy:

```bash
npm run lint
npx tsc --noEmit
npx next build
```

## 2. Architecture in one page

- **Auth:** Google OAuth only (Supabase Auth). `/hrms/auth/callback` signs out
  anyone without an active profile or a pending invitation
  (`my_invitation_status`). `src/proxy.ts` refreshes the session for `/hrms`;
  every page and server action re-checks access on the server
  (`src/hrms/lib/auth/guards.ts`) and returns 404 when the user may not use it.
- **Reads:** through RLS SELECT policies (own / direct reports /
  `employees.read_all`) or through SECURITY DEFINER read functions.
- **Writes:** only through `app_private.*` SECURITY DEFINER functions (empty
  `search_path`, every change written to `audit_logs`), exposed as
  `public.*` SECURITY INVOKER wrappers executable by `authenticated` only.
  No table has an INSERT/UPDATE/DELETE policy and API roles hold no write
  privileges.
- **Locked tables** (no policies, no API privileges): `payroll_runs`,
  `payroll_items`, `employee_documents`, `audit_logs`, `company_settings`.
- **Files:** private bucket `employee-documents`; files open only through
  60-second signed URLs created with the user's session.

## 3. Migration order

Files live in `database/migrations/`; each has `*.apply.sql`, a strict
`*.rollback.sql` and a test in `database/tests/` that runs in one transaction,
ends with `ROLLBACK`, raises `FAIL: …` on any failure and finally returns
`ALL TESTS PASSED`.

| # | Migration | Purpose |
| --- | --- | --- |
| 2.0 | `drop_draft_auth_tables` | remove early drafts |
| 2.1 | `auth_foundation` | roles, permissions, profiles, invitations, `app_private` |
| 2.2 | `super_admin_bootstrap` | one-time super admin, last-super-admin guards, role audit |
| 2.3 | `invitations_workflow` | create / revoke / accept invitations |
| 2.4 | `reference_read_access` | departments, leave types, holidays, company settings |
| 2.7 | `personal_google_accounts` | any Google account, invitation is the gate |
| 2.5 | `employee_compensation` | salary moved off `employees`, compensation policy |
| 2.6 | `scoped_read_access` | own / team / all SELECT policies, privileges revoked |
| 2.8 | `self_service_and_approvals` | phone, attendance, leave, approvals, training |
| 2.9 | `hr_administration` | HR admin functions, roles and account status |
| 2.10 | `payroll_workflow` | payroll runs, items, own payslips |
| 2.11 | `employee_documents` | private bucket, storage policies, documents |
| 2.12 | `security_hardening` | advisor fixes, default privileges, audit viewer |

Note: 2.7 was applied before 2.5/2.6 (numbers 2.5 and 2.6 were free at the
time). 2.0–2.4 and 2.7 were applied in the SQL editor; 2.5 onwards through the
Supabase MCP server (`supabase_migrations.schema_migrations`).

How to apply a new migration:

1. Write `x.y_name.apply.sql` with pre-flight checks, one transaction, plus
   `x.y_name.rollback.sql` and `database/tests/x.y_name_tests.sql`.
2. Review it for privilege escalation and RLS bypass.
3. Apply (MCP `apply_migration` or the SQL editor), then **immediately** run
   the test. Continue only on `ALL TESTS PASSED`.
4. Run the Supabase advisors (security and performance) and fix new findings.
5. Lint, type-check, build, commit.

Every new function must `revoke all … from public, anon` and grant only to
`authenticated`. Since 2.12, new functions created by `postgres` no longer
get EXECUTE for PUBLIC or anon by default, and new public tables give anon
nothing — but always grant explicitly anyway.

## 4. Roles and permissions

| Permission | super_admin | payroll_admin | hr_admin | manager | employee |
| --- | :-: | :-: | :-: | :-: | :-: |
| `users.read` | ✔ | | ✔ | | |
| `roles.manage` (suspend accounts) | ✔ | | | | |
| `invitations.manage` | ✔ | | ✔ | | |
| `employees.read_all` | ✔ | ✔ | ✔ | | |
| `employees.manage` | ✔ | | ✔ | | |
| `compensation.read` / `.manage` | ✔ | ✔ | | | |
| `payroll.read` / `.manage` | ✔ | ✔ | | | |
| `payslips.read_all` | ✔ | ✔ | | | |

- Salary, payroll and payslip permissions are **sensitive**: database
  triggers make it impossible to attach them to any role other than
  `super_admin` and `payroll_admin`.
- **Manager:** sees and approves leave for *direct reports* only. Both are
  required: the `manager` role **and** being `employees.manager_id` of the
  report. Set the manager in Admin → Employees, then grant the role in
  Admin → Users and roles.
- **Employee:** own profile, attendance, leave, holidays, payslips (APPROVED
  or PAID runs, never test data), non-confidential own documents, training,
  announcements for ALL or their department. Can change only: own phone,
  today's check-in/out, apply / cancel pending leave, own training status.
- **Who may change roles:** `super_admin` — any role; `hr_admin` — only
  `manager` / `employee`, only on accounts that hold nothing else. Nobody can
  change their own roles or status. The last active `super_admin` can never
  be removed or suspended (database guard).
- Administrators cannot edit their own employee record or payroll item.

## 5. Inviting users

1. Admin → **Employees**: make sure the person has an employee record whose
   **work email equals the Google account** they will sign in with (Gmail or
   Workspace).
2. Admin → **Invitations**: choose the employee, confirm the email, choose the
   role (super_admin can invite payroll_admin / hr_admin / manager /
   employee; hr_admin can invite manager / employee). Super Admin can never
   be invited.
3. While the Google OAuth app is in **Testing** mode, add the account as a
   Google test user (section 6) — otherwise Google blocks the sign-in.
4. Tell the person to open https://www.nexmiletechnology.com, click
   **Employee Login** (or go to `/hrms/login`) and sign in with that Google account.
   Invitations expire after 14 days; acceptance requires a verified Google
   identity whose email matches.

## 6. Adding Google test users

The OAuth consent screen is **External / Testing**. Only listed test users can
sign in. Keep it that way until a production review is planned.

1. Google Cloud Console → the project used for Supabase Google sign-in.
2. **APIs & Services → OAuth consent screen → Audience** (or "Test users").
3. **Add users** → enter the Google account email → Save.
4. The user can now sign in (an HRMS invitation is still required).

Supabase side: Authentication → Providers → Google is enabled with the
client ID/secret. The Google client's authorised redirect URI is Supabase's
own callback (`https://bgjohvtojkrdssrledrv.supabase.co/auth/v1/callback`), so it
does not change when the site moves. See section 6a for the app URLs.

## 6a. Deployment (Vercel) and sign-in URLs

The whole site (marketing + portal) is one Next.js app deployed on Vercel.

1. **Vercel → Add New → Project →** import `admins-nexmile/NexMileTechnology`
   (framework: Next.js, root directory: repository root, build command
   `next build`).
2. **Environment variables** (Production and Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (publishable key only — never a secret / service-role key).
3. **Domains:** add `www.nexmiletechnology.com` (and the apex
   `nexmiletechnology.com`, redirecting to `www`). Update DNS at the domain
   registrar as Vercel instructs (CNAME `www` → `cname.vercel-dns.com`, apex A
   record). This replaces whatever currently serves the domain.
4. **Supabase → Authentication → URL Configuration:**
   - Site URL: `https://www.nexmiletechnology.com`
   - Redirect URLs (allow-list):
     - `https://www.nexmiletechnology.com/hrms/auth/callback`
     - `http://localhost:3000/hrms/auth/callback`
     - Vercel previews, e.g. `https://*-admins-nexmile.vercel.app/hrms/auth/callback`
   Remove the old `…/auth/callback` (without `/hrms`) entries.
5. **Google Cloud → OAuth consent screen → Branding:** add
   `nexmiletechnology.com` to *Authorised domains* and set the home page /
   privacy policy links to the website.
6. Deploy, open `/hrms/login`, sign in with an invited test user.

Pushing to `main` deploys production. Work on feature branches and merge via
pull request (Vercel builds a preview for every PR).

## 7. Operations

- **Audit log:** Super Admin → Access → **Audit log** (filter by action).
- **Suspend someone:** Super Admin → Users and roles → Suspend. Takes effect
  on their next request.
- **Leaver:** set employment status to *Inactive* (Admin → Employees), then
  suspend the account and remove roles.
- **Payroll:** Payroll runs → create → Start processing → add items
  (untick *Test data* only for real, verified amounts) → Submit for approval
  → Approve → Mark as paid. Items lock after submission; send back to edit.
- **Documents:** Admin → Manage documents. Uploads default to
  *Confidential* (HR only); use *Share with employee* to make visible.

Dashboard settings to review (not configurable from SQL):

- Authentication → Providers: keep **Email** sign-up disabled (Google only).
  The advisor "Leaked password protection disabled" only matters for
  password sign-in; enable it anyway if Email is ever turned on.
- Storage → `employee-documents` must remain **private**.

## 8. Backups and rollback

**Before anything destructive** (dropping a column, deleting data, running a
rollback that deletes rows):

1. Export every row of each affected table, e.g. in the SQL editor:
   `select json_agg(t) from public.<table> t;`
2. Save to `database/backups/<timestamp>_<table>.json` (this folder is
   git-ignored — keep backups out of the repository and store them securely;
   they may contain HR data).
3. Confirm the row counts match the table.

Example: `database/backups/2026-11-12T0000_employees.json` (13 rows) was taken
before 2.5 dropped `employees.monthly_ctc`.

**Supabase backups:** check Dashboard → Database → Backups for the plan's
daily backups / PITR before production. Storage files are not included in
database backups — download documents separately if needed.

**Rolling back a migration:**

- Roll back in reverse order (each rollback refuses to run if a later
  migration still depends on it).
- Read the header of the rollback file first: some rollbacks delete or drop
  data (2.5 deletes `employee_compensation` rows; 2.10 drops
  `approved_by`/`paid_at`; 2.11 requires the bucket to be emptied through the
  Storage API first). Take backups as above.
- Rollbacks are never run automatically. After a rollback, re-run the
  previous migration's test.

## 9. Before production

- Real data only after: a production Supabase project (approval required),
  verified Indian statutory payroll rules, a privacy review of documents and
  payslips, and a backup / restore drill.
- Move the Google OAuth app out of Testing only after Google verification.
- Re-run every test script and the advisors against the production project.
