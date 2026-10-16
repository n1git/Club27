import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface Lookup {
  id: string;
  name: string;
}

export async function getLocations(): Promise<Lookup[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("locations").select("id, name").order("name");
  return data ?? [];
}

export async function getClassTypes(): Promise<Lookup[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("class_types").select("id, name").order("name");
  return data ?? [];
}

export async function getActiveCoaches(): Promise<Lookup[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("instructors")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.full_name }));
}

export interface PackageOption extends Lookup {
  price: number;
  pricingMode: "cycle" | "session_pack";
  billingCycle: string | null;
  sessionsIncluded: number | null;
  validityWeeks: number | null;
}

export async function getActivePackages(): Promise<PackageOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("membership_packages")
    .select("id, name, price, pricing_mode, billing_cycle, sessions_included, validity_weeks")
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    pricingMode: p.pricing_mode,
    billingCycle: p.billing_cycle,
    sessionsIncluded: p.sessions_included,
    validityWeeks: p.validity_weeks,
  }));
}
