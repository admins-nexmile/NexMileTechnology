-- =====================================================================
-- Nexmile HRMS — Rollback for Migration 2.4 (reference-table read access)
-- =====================================================================
-- STATUS: NOT RUN. Use only to undo 2.4, after explicit approval.
--
-- Drops ONLY the three SELECT policies and the functions created by 2.4.
-- RLS stays ENABLED on every table (the tables return to "no policies",
-- i.e. locked). No data or grants are changed.
--
-- Strict: no IF EXISTS / CASCADE; fails if 2.4 was not applied.
-- =====================================================================

begin;

drop policy departments_select_active on public.departments;
drop policy leave_types_select_active on public.leave_types;
drop policy holidays_select_active on public.holidays;

drop function public.get_company_settings();
drop function app_private.get_company_settings();
drop function app_private.is_active_user();

commit;
