"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function LoginForm({ next }: { next: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: formData.get("identifier"),
        password: formData.get("password"),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Gagal masuk");
      setLoading(false);
      return;
    }

    window.location.assign(next ?? data.redirectTo);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-4 transition-opacity duration-300", loading && "opacity-50")}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">Username atau email</Label>
        <Input id="identifier" name="identifier" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Kata Sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        <Link href="/lupa-sandi" className="w-fit text-sm text-accent-foreground underline-offset-4 hover:underline">
          Lupa kata sandi?
        </Link>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
