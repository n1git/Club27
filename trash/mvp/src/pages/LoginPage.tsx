import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login, ROLE_HOME, getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const existing = getSession();
  if (existing) {
    return <Navigate to={ROLE_HOME[existing.role]} replace />;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = login(String(formData.get("email")), String(formData.get("password")));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const session = getSession();
    navigate(session ? ROLE_HOME[session.role] : "/login");
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Swimma (Demo)</CardTitle>
          <CardDescription>
            Demo lokal berbasis localStorage &mdash; bukan aplikasi produksi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Kata Sandi</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit">Masuk</Button>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium">Akun demo:</p>
              <p>admin@demo.dev / admin123</p>
              <p>coach1@demo.dev / coach123</p>
              <p>parent1@demo.dev / parent123</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
