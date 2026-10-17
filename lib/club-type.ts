import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ClubType {
  code: string;
  name: string;
}

export interface ClubTerms {
  member: string;
  coach: string;
  visit: string;
  resource: string;
  session: string;
  location: string;
}

const DEFAULT_TERMS: ClubTerms = {
  member: "Anggota",
  coach: "Pelatih",
  visit: "Kunjungan",
  resource: "Fasilitas",
  session: "Sesi",
  location: "Lokasi",
};

export function mergeTerms(raw: unknown): ClubTerms {
  const terms = { ...DEFAULT_TERMS };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(DEFAULT_TERMS) as (keyof ClubTerms)[]) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) terms[key] = value;
    }
  }
  return terms;
}

export async function getClubTerms(): Promise<ClubTerms> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("clubs").select("club_types(terms)").maybeSingle();
  const clubType = data?.club_types as unknown as { terms: unknown } | null;
  return mergeTerms(clubType?.terms);
}

export async function getReadyClubTypes(): Promise<ClubType[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("club_types").select("code, name").eq("status", "ready").order("sort_order");
    return (data ?? []) as ClubType[];
  } catch {
    return [];
  }
}

export interface PublicClubType {
  code: string;
  name: string;
  status: "ready" | "soon";
  terms: ClubTerms;
  modules: string[];
}

export async function getPublicClubTypes(): Promise<PublicClubType[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const [{ data }, { data: links }] = await Promise.all([
      supabase.from("club_types").select("code, name, status, terms").order("sort_order"),
      supabase.from("club_type_modules").select("club_type, module_code"),
    ]);
    const modules = new Map<string, string[]>();
    for (const l of (links ?? []) as { club_type: string; module_code: string }[]) {
      modules.set(l.club_type, [...(modules.get(l.club_type) ?? []), l.module_code]);
    }
    return ((data ?? []) as { code: string; name: string; status: "ready" | "soon"; terms: unknown }[]).map((t) => ({
      code: t.code,
      name: t.name,
      status: t.status,
      terms: mergeTerms(t.terms),
      modules: modules.get(t.code) ?? [],
    }));
  } catch {
    return [];
  }
}
