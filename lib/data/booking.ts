import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isModuleReady } from "@/lib/modules";
import { getJakartaDateString, getJakartaDayRangeIso } from "@/lib/format";
import { addDays, mondayOf } from "@/lib/booking-grid";
import type { AvailabilitySlot, BookingRow, Resource, ResourceHour, ResourceKind } from "@/lib/booking";

type ResourceRecord = {
  id: string;
  location_id: string;
  name: string;
  kind: string;
  capacity: number;
  slot_minutes: number;
  price_per_slot: number | string;
  advance_days: number;
  cancel_hours: number;
  is_active: boolean;
  locations: { name: string } | { name: string }[] | null;
};

const RESOURCE_SELECT =
  "id, location_id, name, kind, capacity, slot_minutes, price_per_slot, advance_days, cancel_hours, is_active, locations(name)";

function toResource(r: ResourceRecord): Resource {
  const location = Array.isArray(r.locations) ? r.locations[0] : r.locations;
  return {
    id: r.id,
    locationId: r.location_id,
    locationName: location?.name ?? "",
    name: r.name,
    kind: r.kind as ResourceKind,
    capacity: r.capacity,
    slotMinutes: r.slot_minutes,
    pricePerSlot: Number(r.price_per_slot),
    advanceDays: r.advance_days,
    cancelHours: r.cancel_hours,
    isActive: r.is_active,
  };
}

export async function getResources(options: { activeOnly?: boolean } = {}): Promise<Resource[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("resources").select(RESOURCE_SELECT).order("name");
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data } = await query;
  return ((data ?? []) as unknown as ResourceRecord[]).map(toResource);
}

export async function getAllResourceHours(): Promise<Record<string, ResourceHour[]>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("resource_hours").select("resource_id, weekday, opens, closes").order("weekday");
  const out: Record<string, ResourceHour[]> = {};
  for (const h of data ?? []) {
    (out[h.resource_id] ??= []).push({ weekday: h.weekday, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) });
  }
  return out;
}

type BookingRecord = {
  id: string;
  resource_id: string;
  member_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  class_id: string | null;
  start_time: string;
  end_time: string;
  status: BookingRow["status"];
  price: number | string;
  source: BookingRow["source"];
  members?: { full_name: string } | { full_name: string }[] | null;
};

function toBooking(b: BookingRecord): BookingRow {
  const member = Array.isArray(b.members) ? b.members[0] : b.members;
  return {
    id: b.id,
    resourceId: b.resource_id,
    memberId: b.member_id,
    memberName: member?.full_name ?? null,
    guestName: b.guest_name,
    guestPhone: b.guest_phone,
    classId: b.class_id,
    startTime: b.start_time,
    endTime: b.end_time,
    status: b.status,
    price: Number(b.price),
    source: b.source,
  };
}

export async function getBookingsInRange(fromIso: string, toIso: string, resourceIds?: string[]): Promise<BookingRow[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("resource_bookings")
    .select("id, resource_id, member_id, guest_name, guest_phone, class_id, start_time, end_time, status, price, source, members:club_members(full_name)")
    .lt("start_time", toIso)
    .gt("end_time", fromIso)
    .neq("status", "cancelled")
    .order("start_time");
  if (resourceIds) query = query.in("resource_id", resourceIds);
  const { data } = await query;
  return ((data ?? []) as unknown as BookingRecord[]).map(toBooking);
}

export interface MyBooking extends BookingRow {
  resourceName: string;
  locationName: string;
  cancelHours: number;
}

export async function getMyBookings(): Promise<MyBooking[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("resource_bookings")
    .select(
      "id, resource_id, member_id, guest_name, guest_phone, class_id, start_time, end_time, status, price, source, resources(name, cancel_hours, locations(name))"
    )
    .order("start_time", { ascending: false })
    .limit(100);
  type Row = BookingRecord & {
    resources: { name: string; cancel_hours: number; locations: { name: string } | { name: string }[] | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((b) => {
    const location = Array.isArray(b.resources?.locations) ? b.resources?.locations[0] : b.resources?.locations;
    return {
      ...toBooking(b),
      resourceName: b.resources?.name ?? "",
      locationName: location?.name ?? "",
      cancelHours: b.resources?.cancel_hours ?? 0,
    };
  });
}

export async function getAvailability(resourceId: string, date: string): Promise<AvailabilitySlot[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("resource_availability", { p_resource_id: resourceId, p_date: date });
  return ((data ?? []) as Record<string, unknown>[]).map((s) => ({
    start: s.slot_start as string,
    end: s.slot_end as string,
    remaining: Number(s.remaining),
    bookable: Boolean(s.bookable),
    mine: Boolean(s.mine),
  }));
}

export interface ResourcePreset {
  kind: string;
  namePattern: string;
  count: number;
  slotMinutes: number;
  capacity: number;
}

export async function getResourcePreset(): Promise<ResourcePreset | null> {
  const supabase = await createServerSupabaseClient();
  const { data: tenant } = await supabase.from("clubs").select("club_type").maybeSingle();
  if (!tenant?.club_type) return null;
  const { data } = await supabase
    .from("club_type_presets")
    .select("kind, name_pattern, default_count, slot_minutes, default_capacity")
    .eq("club_type", tenant.club_type)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    kind: data.kind,
    namePattern: data.name_pattern,
    count: data.default_count,
    slotMinutes: data.slot_minutes,
    capacity: data.default_capacity,
  };
}

export interface ClassResourceOption {
  id: string;
  name: string;
  locationId: string;
}

export async function getClassResourceOptions(): Promise<ClassResourceOption[]> {
  if (!(await isModuleReady("resource_booking"))) return [];
  return (await getResources({ activeOnly: true })).map((r) => ({ id: r.id, name: r.name, locationId: r.locationId }));
}

export interface BookingKpis {
  bookingsToday: number;
  utilizationWeek: number | null;
}

export async function getBookingKpis(): Promise<BookingKpis> {
  const supabase = await createServerSupabaseClient();
  const { start, end } = getJakartaDayRangeIso();
  const today = getJakartaDateString();
  const monday = mondayOf(today);
  const [{ count }, { data: util }] = await Promise.all([
    supabase
      .from("resource_bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "completed"])
      .gte("start_time", start)
      .lt("start_time", end),
    supabase.rpc("resource_utilization", { p_from: monday, p_to: addDays(monday, 6) }),
  ]);
  return { bookingsToday: count ?? 0, utilizationWeek: util === null || util === undefined ? null : Number(util) };
}
