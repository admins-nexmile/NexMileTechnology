@AGENTS.md

# NexmileTechnology website + employee portal (HRMS) — Project Instructions

## Project identity
- One Next.js App Router app (TypeScript, React, Tailwind CSS v4), deployed on Vercel.
- Public marketing site: `src/app/(site)/`, components in `src/components/`.
- Employee portal (HRMS): routes under `/hrms` in `src/app/hrms/`, code in `src/hrms/`
  (import as `@/hrms/...`). Sign-in at `/hrms/login` ("Employee Login" in the header).
- The HRMS was developed in the separate repo Nexmile-Technology-HRMS and merged here on
  2026-11-12. Operational details: `docs/HRMS_RUNBOOK.md`.

## Backend
- Hosted Supabase project nexmile-hrms-dev (ref bgjohvtojkrdssrledrv): PostgreSQL, Auth, Storage.
- No Docker, no local database, no Supabase CLI local stack. Do not create another Supabase
  project without approval.
- Claude may apply migrations and run SQL on that project only, through the project-scoped
  Supabase MCP server (`.mcp.json`): apply_migration for migrations, execute_sql for tests.
- Every migration: pre-flight checks, one transaction, strict rollback file, and a rollback-only
  test in `database/tests/` whose last query returns `ALL TESTS PASSED` (failures raise `FAIL: ...`).
  Self-review for privilege escalation and RLS bypass; run the test immediately after applying.
- On any error or `FAIL:`, stop. Do not patch by hand or roll back automatically; report and wait.
- Before anything destructive, export affected tables to `database/backups/` (git-ignored).

## Security — mandatory
- Never disable RLS. Policies only via reviewed, tested migrations.
- All writes go through `app_private` SECURITY DEFINER functions (empty search_path, audited to
  audit_logs) with `public` SECURITY INVOKER wrappers granted to authenticated only; revoke from
  public and anon explicitly. No direct client write policies.
- Salary/payroll visible only to super_admin and payroll_admin, plus each employee's own payslips
  from APPROVED or PAID runs that are not test data.
- Never put a service-role / secret key anywhere in this app. Only NEXT_PUBLIC_SUPABASE_URL and
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Never commit .env.local or credentials.
- No public storage buckets for documents or payslips. Files only via short-lived signed URLs.
- Invitation-based accounts, server-verified permissions; users never assign themselves roles.
- Every HRMS page and server action checks access on the server (404 when not permitted).
- `/hrms` must stay out of search engines (robots.txt disallow + noindex metadata).
- Keep `src/proxy.ts` matched to `/hrms` only so marketing pages stay static.

## Development rules
- Never push to or merge into `main` directly (it deploys production); use a feature branch + PR.
  Never force-push.
- Small, reviewable changes; TypeScript types and validation; accessible components.
- Never silently delete existing files or database records.
- Do not run `npm audit fix` automatically. Explain any new package before installing it.
- Run `npm run lint`, `npx tsc --noEmit` and `npx next build` after significant changes.
- Employee and payroll records in the dev project are synthetic. Payroll amounts are manual
  records, not statutory calculations; never describe them as production-ready.
