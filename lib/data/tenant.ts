import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CurrentTenant {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export async function getCurrentTenant(): Promise<CurrentTenant | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("clubs")
    .select("id, name, logo_url, primary_color")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
  };
}
