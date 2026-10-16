"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ResetLinkPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    if (formData.get("password") !== formData.get("confirm")) {
      setError("Konfirmasi kata sandi tidak sama");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: formData.get("password") }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Gagal mengatur kata sandi");
      setLoading(false);
      return;
    }
    window.location.assign(data.redirectTo ?? "/login");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Kata sandi baru</Label>
        <Input id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        <p className="text-xs text-muted-foreground">Minimal 10 karakter, berisi huruf dan angka, dan bukan kata sandi umum.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Ulangi kata sandi</Label>
        <Input id="confirm" name="confirm" type="password" required maxLength={128} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={loading} className="min-h-11">
        {loading ? "Menyimpan..." : "Simpan kata sandi"}
      </Button>
    </form>
  );
}
