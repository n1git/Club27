import { requirePermission } from "@/lib/auth/guard";
import { getProducts } from "@/lib/data/commerce";
import { setProductActive } from "@/lib/actions/products";
import { formatRupiahFull } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ProductForm } from "@/components/pos/product-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TriggerDialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

export default async function ProductsPage() {
  await requirePermission("pos.products_manage");
  const products = await getProducts();
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Produk</>} subtitle={<>Barang dan jasa yang dijual di kasir.</>}>
        <TriggerDialog trigger={<span className={buttonVariants()}>Tambah produk</span>}>
          <h2 className="mb-4 text-xl font-semibold">Tambah produk</h2>
          <ProductForm categories={categories} />
        </TriggerDialog>
      </PageHeader>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Belum ada produk. Gunakan tombol Tambah produk untuk mulai berjualan.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category ?? "-"}</TableCell>
                    <TableCell>{p.sku ?? "-"}</TableCell>
                    <TableCell>{formatRupiahFull(p.price)}</TableCell>
                    <TableCell>
                      {p.trackStock ? (
                        <span className={p.stockQty === 0 ? "font-medium text-destructive" : undefined}>
                          {p.stockQty === 0 ? "Habis" : p.stockQty}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Tidak dilacak</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "success" : "secondary"}>{p.isActive ? "Aktif" : "Nonaktif"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Ubah</span>}>
                          <h2 className="mb-4 text-xl font-semibold">Ubah {p.name}</h2>
                          <ProductForm product={p} categories={categories} />
                        </TriggerDialog>
                        <ActionForm action={setProductActive}>
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="isActive" value={p.isActive ? "false" : "true"} />
                          <Button type="submit" variant="ghost" size="sm">
                            {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </ActionForm>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
