create or replace view instructors with (security_invoker = true) as
select p.id, p.club_id, p.account_id, p.full_name, p.email, p.phone, p.is_active, p.specialization, p.session_rate, p.org_role_id, p.created_at
from club_profiles p
where p.role = 'staff' and is_instructor(p.id);
