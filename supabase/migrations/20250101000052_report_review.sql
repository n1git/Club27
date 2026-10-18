alter table reports
  add column status text not null default 'open' check (status in ('open', 'dismissed', 'removed', 'suspended')),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references superadmins(id) on delete set null;

create index reports_status_idx on reports (status, created_at);
create index reports_reviewed_by_idx on reports (reviewed_by);
create index reports_target_idx on reports (target_type, target_id);

revoke insert on reports from authenticated;
grant insert (target_type, target_id, reason) on reports to authenticated;
