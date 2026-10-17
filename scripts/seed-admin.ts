import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { suggestUsername, usernameSchema } from "../lib/validations/username";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? "Pemilik";
  const tenantName = process.env.SEED_TENANT_NAME;
  const organizationName = process.env.SEED_ORGANIZATION_NAME ?? tenantName;

  if (!email || !password) {
    console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables before running this script.");
    process.exit(1);
  }

  const username = usernameSchema.safeParse(process.env.SEED_ADMIN_USERNAME ?? suggestUsername(email));
  if (!username.success) {
    console.error(`SEED_ADMIN_USERNAME: ${username.error.issues[0]?.message}`);
    process.exit(1);
  }

  if (!tenantName || !organizationName) {
    console.error("Set SEED_TENANT_NAME (the first club's name) before running this script.");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables before running this script."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({
      email,
      username: username.data,
      full_name: fullName,
      password_hash: await bcrypt.hash(password, 10),
      email_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (accountError || !account) {
    console.error("Failed to create account:", accountError?.message);
    process.exit(1);
  }

  const { error } = await supabase.rpc("register_organization", {
    p_organization_name: organizationName,
    p_club_name: tenantName,
    p_account_id: account.id,
    p_plan: process.env.SEED_PLAN ?? "standard",
    p_period: process.env.SEED_PERIOD ?? "monthly",
  });

  if (error) {
    await supabase.from("accounts").delete().eq("id", account.id);
    console.error("Failed to create organization:", error.message);
    process.exit(1);
  }

  console.log(`Organization "${organizationName}" with owner ${email} (username ${username.data}) and club "${tenantName}" created.`);
}

main();
