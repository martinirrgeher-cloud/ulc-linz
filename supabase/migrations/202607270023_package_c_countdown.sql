-- ULC Linz App – Paket C
-- Neues lokales Hilfsmodul „Intervall-Countdown“ inklusive Modulrecht.

insert into public.app_modules (
  key,
  title,
  description,
  route,
  icon,
  sort_order,
  is_active
)
values (
  'countdown',
  'Intervall-Countdown',
  'Belastung und Pause mit Sprachansagen steuern',
  '/module/countdown',
  'timer',
  95,
  true
)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  route = excluded.route,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Das Werkzeug benötigt keine Vereinsdaten und wird bestehenden Mitgliedern
-- daher direkt freigeschaltet. Künftige Mitglieder können das Recht wie gewohnt
-- in der Benutzerverwaltung erhalten oder wieder entzogen bekommen.
insert into public.member_module_permissions (
  membership_id,
  module_key,
  can_view,
  can_edit
)
select
  membership.id,
  'countdown',
  true,
  true
from public.organization_members membership
where membership.status = 'active'
on conflict (membership_id, module_key) do update set
  can_view = true,
  can_edit = true,
  updated_at = now();
