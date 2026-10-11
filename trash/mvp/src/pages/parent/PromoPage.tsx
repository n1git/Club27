import { listActivePromo } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ParentPromoPage() {
  const promos = listActivePromo();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Promo</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {promos.map((p) => (
          <Card key={p.id}>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.title} className="h-40 w-full rounded-t-lg object-cover" />
            ) : null}
            <CardHeader>
              <CardTitle>{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{p.body}</CardContent>
          </Card>
        ))}
        {promos.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada promo aktif.</p> : null}
      </div>
    </div>
  );
}
