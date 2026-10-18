"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import { UsernameField } from "@/components/shared/username-field";

export function RegisterAccountForm({ captchaSiteKey, nonce }: { captchaSiteKey?: string | null; nonce?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/accounts/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        username: formData.get("username"),
        password: formData.get("password"),
        captchaToken: captchaToken || undefined,
        acceptTerms: formData.get("acceptTerms") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUsernameError(data.field === "username" ? data.error : undefined);
      setError(data.error ?? "Gagal membuat akun");
      setLoading(false);
      return;
    }
    window.location.assign(data.redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-4 transition-opacity duration-300", loading && "opacity-50")}>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nama Anda</Label>
        <Input id="fullName" name="fullName" required maxLength={100} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <UsernameField emailName="email" error={usernameError} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Minimal 10 karakter, berisi huruf dan angka, dan bukan kata sandi umum.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          Saya menyetujui{" "}
          <a href="/terms" target="_blank" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Syarat & Ketentuan
          </a>{" "}
          dan{" "}
          <a href="/privacy" target="_blank" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Kebijakan Privasi
          </a>
          .
        </span>
      </label>
      {captchaSiteKey ? <TurnstileWidget siteKey={captchaSiteKey} nonce={nonce} onToken={onCaptcha} /> : null}
      <Button type="submit" disabled={loading || Boolean(captchaSiteKey && !captchaToken)}>
        {loading ? "Membuat akun..." : "Buat akun"}
      </Button>
    </form>
  );
}
