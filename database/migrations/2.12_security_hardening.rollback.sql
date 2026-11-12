-- =====================================================================
-- Nexmile HRMS — ROLLBACK for migration 2.12 (security hardening)
-- =====================================================================
-- Run manually, only after explicit approval. Restores exactly the state
-- found before 2.12 (this re-opens the advisor findings):
--   * rls_auto_enable(): EXECUTE for PUBLIC, anon, authenticated
--   * the four original profiles / user_roles SELECT policies
--   * default privileges: anon X on functions, all on tables (arwdDxtm)
--     and sequences (rwU) in public; global PUBLIC EXECUTE on functions
--   * drops the audit viewer functions
-- No data is changed.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('app_private.audit_list(integer,integer,text)') is null then
    raise exception 'rollback 2.12 aborted: 2.12 objects not found';
  end if;
end
$$;

drop function public.audit_actions();
drop function public.audit_list(integer, integer, text);
drop function app_private.audit_actions();
drop function app_private.audit_list(integer, integer, text);

alter default privileges for role postgres grant execute on functions to public;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant execute on functions to anon;

drop policy user_roles_select on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_roles_select_admin on public.user_roles
  for select to authenticated using ((select app_private.has_permission('roles.manage')));

drop policy profiles_select on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles
  for select to authenticated using ((select app_private.has_permission('users.read')));

grant execute on function public.rls_auto_enable() to public, anon, authenticated;

insert into public.audit_logs (action, entity_type, entity_id, details, actor_employee_id)
values ('migration_rolled_back', 'migration', null,
        pg_catalog.jsonb_build_object('migration', '2.12', 'at', now()), null);

commit;
