-- P2b.1: Statistikrechte in die zugehoerigen Trainingsmodule integrieren.
-- Die alten Statistikmodule bleiben aus historischen Gruenden erhalten, werden aber deaktiviert.

begin;

update public.app_modules
set is_active = false
where key in ('kindertraining_statistics', 'u12_statistics', 'u14_statistics');

delete from public.member_module_permissions
where module_key in ('kindertraining_statistics', 'u12_statistics', 'u14_statistics');

create or replace function public.can_read_kindertraining_statistics(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_access(target_organization_id, 'kindertraining', false);
$$;

create or replace function public.can_edit_kindertraining_statistics(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_access(target_organization_id, 'kindertraining', true);
$$;

create or replace function public.can_read_training_module_statistics(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_attendance_training_module(p_module_key)
    and public.has_module_access(p_organization_id, p_module_key, false);
$$;

create or replace function public.can_edit_training_module_statistics(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_attendance_training_module(p_module_key)
    and public.has_module_access(p_organization_id, p_module_key, true);
$$;

commit;
