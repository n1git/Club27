import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  createAccount,
  createChild,
  listLocations,
  listProfilesByRole,
  searchSimilarChildren,
} from "@/lib/db";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function MemberNewPage() {
  const navigate = useNavigate();
  const locations = listLocations();
  const parents = listProfilesByRole("parent");

  const [parentMode, setParentMode] = useState<"existing" | "new">("existing");
  const [existingParentId, setExistingParentId] = useState("");
  const [contact, setContact] = useState("");
  const [parentFullName, setParentFullName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  const [childFullName, setChildFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredLocationId, setPreferredLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parentMatches = useMemo(() => {
    const term = contact.trim().toLowerCase();
    if (!term) return [];
    return parents
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term) ||
          p.phone?.toLowerCase().includes(term)
      )
      .slice(0, 5);
  }, [contact, parents]);

  const duplicates = useMemo(() => {
    if (childFullName.trim().length < 2) return [];
    return searchSimilarChildren(childFullName, dateOfBirth);
  }, [childFullName, dateOfBirth]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!childFullName.trim() || !dateOfBirth) {
      setError("Nama anak dan tanggal lahir wajib diisi");
      return;
    }

    let parentId = existingParentId;
    if (parentMode === "new") {
      if (!parentFullName.trim() || !parentEmail.trim()) {
        setError("Nama dan email orang tua wajib diisi");
        return;
      }
      const result = createAccount({
        role: "parent",
        fullName: parentFullName,
        email: parentEmail,
        phone: parentPhone || undefined,
        password: "parent123",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      parentId = result.data.id;
    }

    if (!parentId) {
      setError("Orang tua wajib dipilih atau dibuat");
      return;
    }

    createChild({
      parentId,
      fullName: childFullName,
      dateOfBirth,
      notes: notes || undefined,
      address: address || undefined,
      preferredLocationId: preferredLocationId || undefined,
    });

    toast.success("Anggota berhasil ditambahkan");
    navigate("/admin/members");
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <BackLink to="/admin/members" label="Anggota" />
      <h1 className="text-2xl font-semibold">Daftarkan Anggota Baru</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold">1. Orang Tua</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={parentMode === "existing" ? "default" : "outline"}
              size="sm"
              onClick={() => setParentMode("existing")}
            >
              Pilih yang sudah ada
            </Button>
            <Button
              type="button"
              variant={parentMode === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setParentMode("new")}
            >
              Buat akun baru
            </Button>
          </div>

          {parentMode === "existing" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="parent-contact">Cari nama, email, atau telepon orang tua</Label>
              <Input
                id="parent-contact"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setExistingParentId("");
                }}
                placeholder="Ketik untuk mencari..."
              />
              {parentMatches.length > 0 ? (
                <ul className="flex flex-col gap-1 rounded-md border border-border p-2">
                  {parentMatches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setExistingParentId(p.id);
                          setContact(`${p.fullName} (${p.email})`);
                        }}
                        className="w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                      >
                        {p.fullName} — {p.email} {p.phone ? `— ${p.phone}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {existingParentId ? (
                <p className="text-sm text-success">Orang tua terpilih.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada orang tua terpilih.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parentFullName">Nama Orang Tua</Label>
                <Input
                  id="parentFullName"
                  value={parentFullName}
                  onChange={(e) => setParentFullName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parentEmail">Email Orang Tua</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parentPhone">Telepon Orang Tua</Label>
                <Input id="parentPhone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold">2. Data Anak</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="childFullName">Nama Anak</Label>
              <Input
                id="childFullName"
                value={childFullName}
                onChange={(e) => setChildFullName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateOfBirth">Tanggal Lahir</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredLocationId">Lokasi Kolam Pilihan</Label>
              <Select
                id="preferredLocationId"
                value={preferredLocationId}
                onChange={(e) => setPreferredLocationId(e.target.value)}
              >
                <option value="">— Tidak ditentukan —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Alamat Rumah</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {duplicates.length > 0 ? (
            <Alert variant="warning">
              <AlertTitle>Kemungkinan data anak sudah ada</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 flex flex-col gap-1">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      {d.fullName} — lahir {d.dateOfBirth} — orang tua {d.parentName}
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Periksa daftar di atas. Anda tetap bisa melanjutkan jika ini memang anak yang
                  berbeda (misalnya kembar).
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
        </section>

        <Button type="submit" className="w-fit">
          Simpan Anggota
        </Button>
      </form>
    </div>
  );
}
