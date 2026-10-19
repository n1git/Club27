import Link from "next/link";
import { deleteMeasurement } from "@/lib/actions/health";
import { bmi, type Measurement } from "@/lib/data/health";
import { formatJakartaDate } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function formatMeasure(value: number | null, unit = "") {
  return value == null ? "-" : `${value.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}${unit}`;
}

export function MeasurementTable({ rows }: { rows: Measurement[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada catatan kesehatan.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead>Tinggi</TableHead>
          <TableHead>Berat</TableHead>
          <TableHead>IMT</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{formatJakartaDate(`${row.measuredOn}T00:00:00+07:00`, { dateStyle: "medium" })}</TableCell>
            <TableCell>{formatMeasure(row.heightCm, " cm")}</TableCell>
            <TableCell>{formatMeasure(row.weightKg, " kg")}</TableCell>
            <TableCell>{formatMeasure(bmi(row.heightCm, row.weightKg))}</TableCell>
            <TableCell className="flex gap-2">
              <Link href={`/home/health?ubah=${row.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Ubah
              </Link>
              <ActionForm action={deleteMeasurement}>
                <input type="hidden" name="measurementId" value={row.id} />
                <ActionSubmitButton variant="destructive" size="sm" confirmMessage="Hapus catatan ini?">
                  Hapus
                </ActionSubmitButton>
              </ActionForm>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
