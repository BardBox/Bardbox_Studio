-- Dynamic per-role nav permissions
-- Admin can toggle which routes each role can access via /admin/permissions

create table if not exists role_permissions (
  role    text    not null,
  route   text    not null,
  enabled boolean not null default true,
  primary key (role, route)
);

-- Only admins can read/write this table
alter table role_permissions enable row level security;

create policy "admin full access"
  on role_permissions for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- App server reads allowed for any authenticated user (to build their own nav)
create policy "authenticated read"
  on role_permissions for select
  using (auth.role() = 'authenticated');

-- Seed: default sensible permissions for each role
insert into role_permissions (role, route, enabled) values
  -- manager
  ('manager', '/manager',          true),
  ('manager', '/manager/tasks',    true),
  ('manager', '/manager/requests', true),
  ('manager', '/manager/clients',  true),
  ('manager', '/request-task',     true),
  ('manager', '/content',          true),
  ('manager', '/admin/team',       true),
  ('manager', '/hr',               true),
  ('manager', '/smo',              false),
  ('manager', '/designer',         false),
  ('manager', '/ceo',              false),
  ('manager', '/ceo/approvals',    false),
  ('manager', '/admin/roles',      false),
  ('manager', '/admin/settings',   false),
  ('manager', '/admin/permissions',false),

  -- admin
  ('admin', '/manager',          true),
  ('admin', '/manager/tasks',    true),
  ('admin', '/manager/requests', true),
  ('admin', '/manager/clients',  true),
  ('admin', '/request-task',     true),
  ('admin', '/content',          true),
  ('admin', '/smo',              true),
  ('admin', '/designer',         true),
  ('admin', '/ceo',              false),
  ('admin', '/ceo/approvals',    false),
  ('admin', '/admin/team',       true),
  ('admin', '/hr',               true),
  ('admin', '/admin/roles',      true),
  ('admin', '/admin/settings',   true),
  ('admin', '/admin/permissions',true),

  -- ceo
  ('ceo', '/manager',           false),
  ('ceo', '/manager/tasks',     false),
  ('ceo', '/manager/requests',  false),
  ('ceo', '/manager/clients',   false),
  ('ceo', '/request-task',      false),
  ('ceo', '/content',           true),
  ('ceo', '/smo',               false),
  ('ceo', '/designer',          false),
  ('ceo', '/ceo',               true),
  ('ceo', '/ceo/approvals',     true),
  ('ceo', '/admin/team',        true),
  ('ceo', '/hr',                false),
  ('ceo', '/admin/roles',       false),
  ('ceo', '/admin/settings',    false),
  ('ceo', '/admin/permissions', false),

  -- smo
  ('smo', '/manager',           false),
  ('smo', '/manager/tasks',     false),
  ('smo', '/manager/requests',  false),
  ('smo', '/manager/clients',   false),
  ('smo', '/request-task',      true),
  ('smo', '/content',           true),
  ('smo', '/smo',               true),
  ('smo', '/designer',          false),
  ('smo', '/ceo',               false),
  ('smo', '/ceo/approvals',     false),
  ('smo', '/admin/team',        false),
  ('smo', '/hr',                false),
  ('smo', '/admin/roles',       false),
  ('smo', '/admin/settings',    false),
  ('smo', '/admin/permissions', false),

  -- designer
  ('designer', '/manager',           false),
  ('designer', '/manager/tasks',     false),
  ('designer', '/manager/requests',  false),
  ('designer', '/manager/clients',   false),
  ('designer', '/request-task',      true),
  ('designer', '/content',           true),
  ('designer', '/smo',               false),
  ('designer', '/designer',          true),
  ('designer', '/ceo',               false),
  ('designer', '/ceo/approvals',     false),
  ('designer', '/admin/team',        false),
  ('designer', '/hr',                false),
  ('designer', '/admin/roles',       false),
  ('designer', '/admin/settings',    false),
  ('designer', '/admin/permissions', false),

  -- hr
  ('hr', '/manager',           false),
  ('hr', '/manager/tasks',     false),
  ('hr', '/manager/requests',  false),
  ('hr', '/manager/clients',   false),
  ('hr', '/request-task',      false),
  ('hr', '/content',           false),
  ('hr', '/smo',               false),
  ('hr', '/designer',          false),
  ('hr', '/ceo',               false),
  ('hr', '/ceo/approvals',     false),
  ('hr', '/admin/team',        true),
  ('hr', '/hr',                true),
  ('hr', '/admin/roles',       false),
  ('hr', '/admin/settings',    false),
  ('hr', '/admin/permissions', false),

  -- developer
  ('developer', '/manager',           true),
  ('developer', '/manager/tasks',     true),
  ('developer', '/manager/requests',  false),
  ('developer', '/manager/clients',   false),
  ('developer', '/request-task',      true),
  ('developer', '/content',           false),
  ('developer', '/smo',               false),
  ('developer', '/designer',          false),
  ('developer', '/ceo',               false),
  ('developer', '/ceo/approvals',     false),
  ('developer', '/admin/team',        false),
  ('developer', '/hr',                false),
  ('developer', '/admin/roles',       true),
  ('developer', '/admin/settings',    true),
  ('developer', '/admin/permissions', false)

on conflict (role, route) do nothing;
