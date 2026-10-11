import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { suggestUsername, superadminUsernameSchema } from "../lib/validations/username";

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  const fullName = process.env.SEED_SUPERADMIN_NAME ?? "Superadmin";

  if (!email || !password) {
    console.error(
      "Set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD environment variables before running this script."
    );
    process.exit(1);
  }

  const username = superadminUsernameSchema.safeParse(process.env.SEED_SUPERADMIN_USERNAME ?? suggestUsername(email, true));
  if (!username.success) {
    console.error(`SEED_SUPERADMIN_USERNAME: ${username.error.issues[0]?.message}`);
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("SEED_SUPERADMIN_PASSWORD must be at least 12 characters.");
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

  const { data: existing } = await supabase
    .from("superadmins")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    console.error(`A superadmin with email ${email} already exists (id: ${existing.id}).`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { error } = await supabase
    .from("superadmins")
    .insert({ email, username: username.data, full_name: fullName, password_hash: passwordHash });

  if (error) {
    console.error("Failed to create superadmin:", error.message === "Username sudah dipakai" ? "username already taken" : error.message);
    process.exit(1);
  }

  console.log(`Superadmin account created for ${email} (username ${username.data}). Log in at /superadmin/login.`);
}

main();
