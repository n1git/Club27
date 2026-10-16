begin;

select set_config('club27.purge', 'on', true);

truncate accounts, org_owners, member_accounts, organizations, tenants, auth_rate_limits, consents, audit_log cascade;

select
  (select count(*) from organizations) as organizations,
  (select count(*) from profiles) as profiles,
  (select count(*) from accounts) as accounts,
  (select count(*) from subscription_plans) as plans_kept,
  (select count(*) from superadmins) as superadmins_kept,
  (select count(*) from club_types) as club_types_kept;

rollback;
