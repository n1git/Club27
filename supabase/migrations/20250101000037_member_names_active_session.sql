create or replace view member_names with (security_barrier = true) as
select id, tenant_id, full_name, is_active
from members
where tenant_id = (select current_tenant_id())
  and (select is_active_user())
  and ((select is_admin()) or (select is_receptionist()) or (select is_finance()));
