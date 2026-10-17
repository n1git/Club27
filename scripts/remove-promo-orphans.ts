import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: promos, error: promoError } = await supabase.from("promos").select("image_url").not("image_url", "is", null);
  if (promoError) throw new Error(promoError.message);
  const marker = "/storage/v1/object/public/promo/";
  const used = new Set(
    (promos ?? []).map((p) => {
      const url = p.image_url as string;
      const i = url.indexOf(marker);
      return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : url;
    })
  );

  const { data: folders, error: listError } = await supabase.storage.from("promos").list("", { limit: 1000 });
  if (listError) throw new Error(listError.message);
  const orphans: string[] = [];
  for (const folder of folders ?? []) {
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error } = await supabase.storage.from("promos").list(folder.name, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      for (const file of files ?? []) {
        const path = `${folder.name}/${file.name}`;
        if (!used.has(path)) orphans.push(path);
      }
      if (!files || files.length < 1000) break;
    }
  }

  console.log(`${orphans.length} orphaned promo file(s)${dryRun ? " (dry run, pass --apply to delete)" : ""}`);
  if (!dryRun) {
    for (let i = 0; i < orphans.length; i += 100) {
      const { error } = await supabase.storage.from("promos").remove(orphans.slice(i, i + 100));
      if (error) throw new Error(error.message);
    }
    console.log("deleted");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
