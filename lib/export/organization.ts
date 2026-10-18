import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/export/csv";
import { buildZip, type ZipEntry } from "@/lib/export/zip";
import { APP_NAME } from "@/lib/config";

const PAGE = 1000;
const HIDDEN = new Set(["secret", "password_hash", "token_hash", "totp_secret", "totp_pending_secret", "sessions_valid_after"]);

const CLUB_TABLES: { file: string; table: string; order?: string[] }[] = [
  { file: "anggota", table: "club_members" },
  { file: "paket_keanggotaan", table: "membership_packages" },
  { file: "langganan_anggota", table: "member_memberships" },
  { file: "tagihan", table: "invoices" },
  { file: "jenis_kelas", table: "class_types" },
  { file: "kelas", table: "classes" },
  { file: "booking_kelas", table: "class_bookings" },
  { file: "lokasi", table: "locations" },
  { file: "fasilitas", table: "resources" },
  { file: "jam_fasilitas", table: "resource_hours", order: ["resource_id", "weekday"] },
  { file: "booking_fasilitas", table: "resource_bookings" },
  { file: "titik_checkin", table: "checkin_points" },
  { file: "checkin", table: "checkins" },
  { file: "produk", table: "products" },
  { file: "pesanan", table: "orders" },
  { file: "item_pesanan", table: "order_items" },
  { file: "pembayaran_pesanan", table: "order_payments" },
  { file: "buku_kas", table: "cash_ledger" },
  { file: "penggajian", table: "payroll_runs" },
  { file: "sertifikasi_pelatih", table: "coach_certifications" },
  { file: "promo", table: "promos" },
  { file: "persetujuan", table: "consents" },
  { file: "permintaan_gabung", table: "club_join_requests" },
];

type Row = Record<string, unknown>;

async function fetchAll(table: string, column: string, values: string[], order: string[] = ["id"]): Promise<Row[]> {
  const supabase = createAdminSupabaseClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select("*").in(column, values);
    for (const key of order) query = query.order(key, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`export failed for ${table}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function clean(rows: Row[], clubs: Map<string, string>): Row[] {
  return rows.map((row) => {
    const out: Row = {};
    if (typeof row.club_id === "string") out.klub = clubs.get(row.club_id) ?? "";
    for (const [key, value] of Object.entries(row)) if (!HIDDEN.has(key)) out[key] = value;
    return out;
  });
}

export async function buildOrganizationExport(organizationId: string): Promise<{ filename: string; zip: Buffer }> {
  const supabase = createAdminSupabaseClient();
  const [{ data: org }, { data: tenants }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.from("clubs").select("id, name, slug, club_type").eq("organization_id", organizationId).order("created_at"),
  ]);
  if (!org) throw new Error("organization not found");
  const clubs = new Map((tenants ?? []).map((t) => [t.id as string, t.name as string]));
  const tenantIds = Array.from(clubs.keys());
  const entries: ZipEntry[] = [];
  const add = (file: string, rows: Row[], columns?: string[]) => entries.push({ name: `${file}.csv`, data: toCsv(rows, columns) });
  const counts: string[] = [];

  add("klub", (tenants ?? []) as Row[]);
  counts.push(`klub: ${tenants?.length ?? 0}`);

  for (const { file, table, order } of CLUB_TABLES) {
    const rows = tenantIds.length ? clean(await fetchAll(table, "club_id", tenantIds, order), clubs) : [];
    add(file, rows);
    counts.push(`${file}: ${rows.length}`);
  }

  const staff = tenantIds.length
    ? clean(
        await fetchAll("club_profiles", "club_id", tenantIds),
        clubs
      )
        .filter((row) => row.role === "owner" || row.role === "staff")
        .map(({ klub, id, role, full_name, email, phone, is_active, org_role_id, specialization, session_rate, created_at }) => ({
        klub, id, role, full_name, email, phone, is_active, org_role_id, specialization, session_rate, created_at,
      }))
    : [];
  add("staf_dan_pemilik", staff);
  counts.push(`staf_dan_pemilik: ${staff.length}`);

  const { data: roles } = await supabase
    .from("organization_roles")
    .select("id, name, is_paid, role_permissions(permission_code)")
    .eq("organization_id", organizationId);
  add(
    "peran",
    (roles ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      is_paid: r.is_paid,
      permissions: ((r.role_permissions as { permission_code: string }[] | null) ?? []).map((p) => p.permission_code).join(" "),
    }))
  );

  const audit = await fetchAll("audit_log", "organization_id", [organizationId]);
  add("log_audit", audit);
  counts.push(`log_audit: ${audit.length}`);

  const stamp = new Date().toISOString();
  entries.unshift({
    name: "BACA_SAYA.txt",
    data: Buffer.from(
      `Ekspor data ${org.name} dari ${APP_NAME}\r\nDibuat: ${stamp}\r\n\r\nSetiap file .csv berisi satu jenis data (UTF-8, dapat dibuka di Excel atau Google Sheets). Kolom id dan *_id menghubungkan antar file; kolom klub memuat nama klub.\r\nKata sandi, rahasia titik check-in, dan token tidak disertakan.\r\nFile gambar promo di penyimpanan tidak ikut diekspor; kolom image_url berisi tautannya.\r\n\r\nJumlah baris:\r\n${counts.join("\r\n")}\r\n`,
      "utf8"
    ),
  });

  const slug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "organisasi";
  return { filename: `ekspor-${slug}-${stamp.slice(0, 10)}.zip`, zip: buildZip(entries) };
}
