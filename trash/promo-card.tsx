import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PromoItem {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  active_from: string;
  active_until: string | null;
}

export function PromoCard({ promo }: { promo: PromoItem }) {
  return (
    <Card>
      {promo.image_url ? (
        <div className="relative h-40 w-full overflow-hidden rounded-t-lg">
          <Image src={promo.image_url} alt={promo.title} fill className="object-cover" unoptimized />
        </div>
      ) : null}
      <CardHeader>
        <CardTitle>{promo.title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{promo.body}</CardContent>
    </Card>
  );
}
