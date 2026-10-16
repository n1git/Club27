begin;

drop function purge_organization(uuid, boolean);
drop function purge_candidates();
drop function cancel_organization_deletion(uuid, uuid);
drop function request_organization_deletion(uuid, uuid);
drop table organization_purges;
drop table platform_flags;

alter table organizations
  drop constraint organizations_deletion_pair_check,
  drop column deletion_requested_at,
  drop column deletion_requested_by,
  drop column purge_after,
  drop column deletion_previous_status;

commit;
