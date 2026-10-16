import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function logAudit(entry: {
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
  tenantId?: string | null;
  organizationId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  actorLabel?: string | null;
}) {
  const { error } = await createAdminSupabaseClient().rpc("log_audit", {
    p_action: entry.action,
    p_target_type: entry.targetType ?? null,
    p_target_id: entry.targetId ?? null,
    p_details: entry.details ?? {},
    p_tenant_id: entry.tenantId || null,
    p_organization_id: entry.organizationId || null,
    p_actor_id: entry.actorId ?? null,
    p_actor_role: entry.actorRole ?? null,
    p_actor_label: entry.actorLabel ?? null,
  });
  if (error) console.error(`audit: failed to record ${entry.action}`);
}
