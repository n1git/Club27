import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateTempPassword, hashPassword } from "../lib/auth/password";

const PREFIX = "[DEMO]";
const DOMAIN = "demo.club27.test";

interface Args {
  scale: "demo" | "full";
  emitSql: boolean;
  purge: boolean;
  credentials: string;
}

function parseArgs(argv: string[]): Args {
  const has = (flag: string) => argv.includes(flag);
  const value = (flag: string, fallback: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const hosted = has("--hosted");
  const scale = hosted ? "demo" : (value("--scale", "full") as Args["scale"]);
  if (scale !== "demo" && scale !== "full") throw new Error("--scale must be demo or full");
  return {
    scale,
    emitSql: has("--emit-sql") || hosted,
    purge: has("--purge"),
    credentials: value("--credentials", path.join("audit", "seed-credentials.json")),
  };
}

interface Credential {
  role: string;
  email: string;
  password: string;
  org: string;
  club: string;
}

const credentials: Credential[] = [];

async function account(role: string, local: string, org: string, club: string) {
  const email = `${local}@${DOMAIN}`;
  const password = generateTempPassword(14);
  credentials.push({ role, email, password, org, club });
  return { email, hash: await hashPassword(password), password };
}

const STAFF_NAMES = [
  "Agus Wibowo", "Siti Rahayu", "Rizky Pratama", "Dewi Lestari", "Hendra Gunawan", "Maya Kusuma",
  "Dimas Saputra", "Nadia Hartono", "Bayu Nugroho", "Citra Wardhana", "Yoga Prasetyo", "Intan Maharani",
  "Galih Setiawan", "Anisa Hakim", "Teguh Susanto", "Melati Suryani", "Arif Kurniawan", "Kirana Purnama",
];

let nameIndex = 0;
const nextName = () => STAFF_NAMES[nameIndex++ % STAFF_NAMES.length];

interface ClubDef {
  key: string;
  name: string;
  type: string;
  members?: number;
  coaches?: number;
  load?: boolean;
  crossAccount?: boolean;
}

interface OrgDef {
  key: string;
  name: string;
  plan: "standard" | "advanced";
  period: "monthly" | "yearly";
  status: "active" | "trial" | "pending";
  finalize?: "trial-expired" | "suspended";
  staffless?: boolean;
  clubs: ClubDef[];
}

function definitions(scale: Args["scale"]): OrgDef[] {
  const m = scale === "demo" ? 24 : 120;
  if (scale === "demo") {
    return [
      {
        key: "aqua", name: "Grup Akuatik Nusantara", plan: "standard", period: "monthly", status: "active",
        clubs: [
          { key: "tirta", name: "Tirta Jaya Swim Club", type: "swimming", members: m, crossAccount: true },
          { key: "primafit", name: "Prima Fit Gym", type: "gym", members: m },
        ],
      },
      {
        key: "nusa", name: "Nusantara Sports", plan: "advanced", period: "yearly", status: "active",
        clubs: [
          { key: "ace", name: "Ace Tennis Club", type: "tennis", members: m, crossAccount: true },
          { key: "yogasari", name: "Yoga Sari Studio", type: "yoga", members: m },
        ],
      },
    ];
  }
  return [
    {
      key: "aqua", name: "Grup Akuatik Nusantara", plan: "standard", period: "monthly", status: "active",
      clubs: [
        { key: "tirta", name: "Tirta Jaya Swim Club", type: "swimming", members: m, crossAccount: true },
        { key: "primafit", name: "Prima Fit Gym", type: "gym", members: m },
        { key: "smash", name: "Smash Padel", type: "padel", members: m },
      ],
    },
    {
      key: "nusa", name: "Nusantara Sports", plan: "advanced", period: "yearly", status: "active",
      clubs: [
        { key: "ace", name: "Ace Tennis Club", type: "tennis", members: m, crossAccount: true },
        { key: "lentur", name: "Studio Lentur Pilates", type: "pilates", members: m },
        { key: "yogasari", name: "Yoga Sari Studio", type: "yoga", members: m },
        { key: "aquakids", name: "Aqua Kids Swim", type: "swimming", members: m },
        { key: "load", name: "Load Club Gym", type: "gym", members: 5000, coaches: 10, load: true },
      ],
    },
    { key: "pending", name: "Org Menunggu Aktivasi", plan: "advanced", period: "monthly", status: "pending", staffless: true, clubs: [{ key: "pendingclub", name: "Klub Menunggu", type: "swimming", members: 0 }] },
    { key: "expired", name: "Org Trial Habis", plan: "standard", period: "monthly", status: "trial", finalize: "trial-expired", clubs: [{ key: "trialhabis", name: "Klub Trial Habis", type: "swimming", members: m }] },
    { key: "suspended", name: "Org Ditangguhkan", plan: "standard", period: "monthly", status: "trial", finalize: "suspended", clubs: [{ key: "ditangguhkan", name: "Klub Ditangguhkan", type: "tennis", members: m }] },
  ];
}

async function buildSpec(scale: Args["scale"]) {
  const crossLocal = "anggota.lintas";
  const cross = await account("member", crossLocal, "lintas", "lintas");
  const orgs = [];
  for (const def of definitions(scale)) {
    const owner = await account("owner", `owner.${def.key}`, def.name, "(semua klub)");
    const clubs = [];
    for (const club of def.clubs) {
      const staff: Record<string, unknown>[] = [];
      let memberAccounts: Record<string, unknown>[] = [];
      if (!def.staffless) {
        const roles: { role: string; local: string; head?: boolean }[] = [
          { role: "admin", local: `admin.${club.key}` },
          { role: "receptionist", local: `resepsionis.${club.key}` },
          { role: "finance", local: `keuangan.${club.key}` },
        ];
        const coachCount = club.coaches ?? 2;
        for (let i = 1; i <= coachCount; i++) {
          roles.push({ role: "coach", local: `pelatih${i}.${club.key}`, head: i === 2 });
        }
        for (const r of roles) {
          const a = await account(r.role === "coach" && r.head ? "head_coach" : r.role, r.local, def.name, club.name);
          staff.push({ role: r.role, name: nextName(), email: a.email, hash: a.hash, head: r.head ?? false });
        }
        if (!club.load) {
          for (let i = 1; i <= 2; i++) {
            const a = await account("member", `anggota${i}.${club.key}`, def.name, club.name);
            memberAccounts.push({ idx: i, email: a.email, hash: a.hash });
          }
          if (club.crossAccount) memberAccounts.push({ idx: 0, email: cross.email, hash: cross.hash });
        }
      } else {
        memberAccounts = [];
      }
      clubs.push({ key: club.key, name: `${PREFIX} ${club.name}`, type: club.type, members: club.members ?? 0, load: club.load ?? false, staff, memberAccounts });
    }
    orgs.push({
      key: def.key,
      name: `${PREFIX} ${def.name}`,
      plan: def.plan,
      period: def.period,
      status: def.status === "pending" ? "pending" : def.status === "active" ? "active" : "trial",
      staffless: def.staffless ?? false,
      finalize: def.finalize ?? null,
      owner: { name: nextName(), email: owner.email, hash: owner.hash },
      clubs,
    });
  }
  return { prefix: PREFIX, orgs };
}

function seedSql(spec: unknown): string {
  const json = JSON.stringify(spec);
  if (json.includes("$spec$")) throw new Error("spec contains the dollar-quote delimiter");
  return readFileSync(path.join(__dirname, "seed-demo.sql"), "utf8").replace("__SPEC__", () => json);
}

function purgeSql(): string {
  return `do $purge$
declare
  v_tenants uuid[];
  v_orgs uuid[];
begin
  select array_agg(id) into v_orgs from organizations where name like '${PREFIX}%';
  select array_agg(id) into v_tenants from tenants where organization_id = any(coalesce(v_orgs, '{}'));
  if v_orgs is null then
    raise notice 'purge: nothing to remove';
    return;
  end if;
  v_tenants := coalesce(v_tenants, '{}');
  perform set_config('club27.purge', 'on', true);
  delete from audit_log where tenant_id = any(v_tenants) or organization_id = any(v_orgs);
  delete from consents where tenant_id = any(v_tenants) or organization_id = any(v_orgs);
  delete from email_verifications where organization_id = any(v_orgs);
  update payroll_runs set cash_ledger_entry_id = null where tenant_id = any(v_tenants);
  delete from order_payments where tenant_id = any(v_tenants);
  delete from order_items where tenant_id = any(v_tenants);
  delete from cash_ledger where tenant_id = any(v_tenants);
  delete from orders where tenant_id = any(v_tenants);
  delete from payroll_runs where tenant_id = any(v_tenants);
  delete from checkins where tenant_id = any(v_tenants);
  delete from checkin_points where tenant_id = any(v_tenants);
  delete from resource_bookings where tenant_id = any(v_tenants);
  delete from bookings where tenant_id = any(v_tenants);
  delete from classes where tenant_id = any(v_tenants);
  delete from class_types where tenant_id = any(v_tenants);
  delete from resource_hours where tenant_id = any(v_tenants);
  delete from resources where tenant_id = any(v_tenants);
  delete from coach_certifications where tenant_id = any(v_tenants);
  delete from invoices where tenant_id = any(v_tenants);
  delete from subscriptions where tenant_id = any(v_tenants);
  delete from membership_packages where tenant_id = any(v_tenants);
  delete from promo where tenant_id = any(v_tenants);
  delete from products where tenant_id = any(v_tenants);
  delete from order_counters where tenant_id = any(v_tenants);
  delete from tenant_module_overrides where tenant_id = any(v_tenants);
  delete from members where tenant_id = any(v_tenants);
  delete from profiles where tenant_id = any(v_tenants);
  delete from locations where tenant_id = any(v_tenants);
  delete from tenants where id = any(v_tenants);
  delete from organization_members where organization_id = any(v_orgs);
  delete from accounts where email like '%@${DOMAIN}';
  delete from organization_subscriptions where organization_id = any(v_orgs);
  delete from organizations where id = any(v_orgs);
  raise notice 'purge: removed % organizations', array_length(v_orgs, 1);
end
$purge$;
`;
}

function alreadySeeded(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  const result = spawnSync("psql", [url, "-At", "-c", `select count(*) from organizations where name like '${PREFIX}%'`], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "psql failed");
  return Number(result.stdout.trim()) > 0;
}

function run(sql: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL or use --emit-sql");
  const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
  if (result.status !== 0) throw new Error(`psql exited with ${result.status}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.purge) {
    const sql = purgeSql();
    if (args.emitSql) process.stdout.write(sql);
    else run(sql);
    return;
  }
  if (!args.emitSql && alreadySeeded()) {
    console.error("seed-demo: already seeded, nothing to do (credentials file left untouched)");
    return;
  }
  const spec = await buildSpec(args.scale);
  mkdirSync(path.dirname(args.credentials), { recursive: true });
  writeFileSync(args.credentials, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  const sql = seedSql(spec);
  if (args.emitSql) process.stdout.write(sql);
  else run(sql);
  console.error(`seed-demo: ${args.scale} scale, ${credentials.length} accounts, credentials written to ${args.credentials}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
