"use client";

import { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Step =
  | { name: "password" }
  | { name: "totp"; recovery: boolean }
  | { name: "enroll"; secret: string; uri: string }
  | { name: "codes"; codes: string[]; redirectTo: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

function EnrollQr({ uri }: { uri: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(uri);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [uri]);
  return (
    <div
      className="mx-auto size-48 rounded-md bg-white p-2 [&>svg]:size-full"
      role="img"
      aria-label="Kode QR untuk aplikasi autentikator"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CodeField({ recovery }: { recovery: boolean }) {
  return recovery ? (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="recoveryCode">Kode pemulihan</Label>
      <Input id="recoveryCode" name="recoveryCode" required autoComplete="off" maxLength={20} placeholder="XXXXX-XXXXX" />
    </div>
  ) : (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="code">Kode 6 digit</Label>
      <Input
        id="code"
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        aria-describedby="code-hint"
      />
      <p id="code-hint" className="text-xs text-muted-foreground">
        Kode dari aplikasi autentikator, berganti tiap 30 detik.
      </p>
    </div>
  );
}

export function SuperadminLoginForm() {
  const [step, setStep] = useState<Step>({ name: "password" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    if (step.name === "password") {
      const { ok, data } = await post("/api/superadmin/login", {
        identifier: formData.get("identifier"),
        password: formData.get("password"),
      });
      setLoading(false);
      if (!ok) return setError(data.error ?? "Gagal masuk");
      if (data.step === "enroll") return setStep({ name: "enroll", secret: data.secret, uri: data.uri });
      return setStep({ name: "totp", recovery: false });
    }

    const { ok, data } = await post("/api/superadmin/mfa", {
      code: formData.get("code") ?? undefined,
      recoveryCode: formData.get("recoveryCode") ?? undefined,
    });
    setLoading(false);
    if (!ok) {
      if (data.restart) setStep({ name: "password" });
      return setError(data.error ?? "Kode tidak valid");
    }
    if (data.recoveryCodes) return setStep({ name: "codes", codes: data.recoveryCodes, redirectTo: data.redirectTo });
    window.location.assign(data.redirectTo);
  }

  if (step.name === "codes") {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Simpan kode pemulihan ini di tempat aman. Setiap kode hanya bisa dipakai sekali jika ponsel Anda hilang. Kode
            tidak akan ditampilkan lagi.
          </AlertDescription>
        </Alert>
        <ul className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted p-3 font-mono text-sm" aria-label="Kode pemulihan">
          {step.codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            await navigator.clipboard.writeText(step.codes.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? "Tersalin" : "Salin semua kode"}
        </Button>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            window.location.assign(step.redirectTo);
          }}
        >
          Saya sudah menyimpan, lanjutkan
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-4 transition-opacity duration-300", loading && "opacity-50")}
    >
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step.name === "password" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier">Username atau email</Label>
            <Input id="identifier" name="identifier" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Kata Sandi</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
        </>
      ) : null}

      {step.name === "enroll" ? (
        <>
          <p className="text-sm">
            Verifikasi dua langkah wajib untuk admin platform. Pindai kode QR dengan aplikasi autentikator (misalnya Google
            Authenticator atau 1Password), lalu masukkan kode yang muncul.
          </p>
          <EnrollQr uri={step.uri} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Atau masukkan kunci ini secara manual:</span>
            <code className="break-all rounded-md bg-muted px-2 py-1 font-mono text-sm">{step.secret}</code>
          </div>
          <CodeField recovery={false} />
        </>
      ) : null}

      {step.name === "totp" ? (
        <>
          <CodeField key={String(step.recovery)} recovery={step.recovery} />
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-6 self-start p-0"
            onClick={() => setStep({ name: "totp", recovery: !step.recovery })}
          >
            {step.recovery ? "Pakai kode dari aplikasi autentikator" : "Pakai kode pemulihan"}
          </Button>
        </>
      ) : null}

      <Button type="submit" disabled={loading} className="min-h-11">
        {loading ? "Memproses..." : step.name === "password" ? "Masuk" : "Verifikasi"}
      </Button>
    </form>
  );
}
