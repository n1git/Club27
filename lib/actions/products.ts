"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isModuleReady } from "@/lib/modules";
import { productSchema } from "@/lib/validations/commerce";
import { type ActionState } from "./types";

const MODULE_ERROR: ActionState = { ok: false, error: "Produk & Kasir tidak aktif untuk klub ini" };

function parse(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    category: formData.get("category") || undefined,
    price: formData.get("price"),
    trackStock: formData.get("trackStock") === "on",
    stockQty: formData.get("trackStock") === "on" ? formData.get("stockQty") || 0 : 0,
  });
}

function refresh() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/pos");
}

export async function createProduct(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("pos.products_manage");
  if (!(await isModuleReady("pos"))) return MODULE_ERROR;
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const v = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("products").insert({
    name: v.name,
    sku: v.sku ?? null,
    category: v.category ?? null,
    price: v.price,
    track_stock: v.trackStock,
    stock_qty: v.stockQty,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "SKU sudah dipakai" : "Gagal menyimpan produk" };
  refresh();
  return { ok: true, message: "Produk ditambahkan" };
}

export async function updateProduct(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("pos.products_manage");
  if (!(await isModuleReady("pos"))) return MODULE_ERROR;
  const id = z.string().uuid().safeParse(formData.get("productId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const v = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      name: v.name,
      sku: v.sku ?? null,
      category: v.category ?? null,
      price: v.price,
      track_stock: v.trackStock,
      stock_qty: v.stockQty,
    })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { ok: false, error: error?.code === "23505" ? "SKU sudah dipakai" : "Gagal menyimpan produk" };
  refresh();
  return { ok: true, message: "Produk disimpan" };
}

export async function setProductActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("pos.products_manage");
  const parsed = z
    .object({ productId: z.string().uuid(), isActive: z.enum(["true", "false"]) })
    .safeParse({ productId: formData.get("productId"), isActive: formData.get("isActive") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: parsed.data.isActive === "true" })
    .eq("id", parsed.data.productId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal mengubah status" };
  refresh();
  return { ok: true, message: parsed.data.isActive === "true" ? "Produk diaktifkan" : "Produk dinonaktifkan" };
}
