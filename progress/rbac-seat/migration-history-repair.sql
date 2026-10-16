begin;

create temp table repo_migrations (version text, name text);
insert into repo_migrations values
('20250101000001', 'extensions'),
('20250101000002', 'schema'),
('20250101000003', 'functions_and_rpcs'),
('20250101000004', 'rls_policies'),
('20250101000005', 'views'),
('20250101000006', 'grants'),
('20250101000007', 'duplicate_search'),
('20250101000008', 'promo_storage'),
('20250101000009', 'session_packages'),
('20250101000010', 'platform_billing'),
('20250101000011', 'security_fixes'),
('20250101000012', 'organizations'),
('20250101000013', 'members'),
('20250101000014', 'org_billing'),
('20250101000015', 'coach_profiles'),
('20250101000016', 'staff_roles'),
('20250101000017', 'member_login'),
('20250101000018', 'club_types'),
('20250101000019', 'gym_checkin'),
('20250101000020', 'modules_onboarding'),
('20250101000021', 'resource_booking'),
('20250101000022', 'commerce'),
('20250101000023', 'sport_club_types'),
('20250101000024', 'privilege_hardening'),
('20250101000025', 'session_access'),
('20250101000026', 'money_billing'),
('20250101000027', 'policy_performance'),
('20250101000028', 'registration_verification'),
('20250101000029', 'audit_privacy_uploads'),
('20250101000030', 'validation_booking_rules'),
('20250101000031', 'brand_name'),
('20250101000032', 'internal_identifiers'),
('20250101000033', 'usernames'),
('20250101000034', 'request_idempotency'),
('20250101000035', 'subscription_renewals'),
('20250101000036', 'brand_name_27club'),
('20250101000037', 'member_names_active_session'),
('20250101000038', 'midtrans_payments')
;

update supabase_migrations.schema_migrations h
set version = r.version
from repo_migrations r
where h.name = r.name and h.version <> r.version;

insert into supabase_migrations.schema_migrations (version, name)
select r.version, r.name from repo_migrations r
where not exists (select 1 from supabase_migrations.schema_migrations h where h.version = r.version);

select count(*) as recorded, count(*) filter (where version in (select version from repo_migrations)) as matching
from supabase_migrations.schema_migrations;

rollback;
