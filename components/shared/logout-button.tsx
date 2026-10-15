"use client";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Keluar
    </Button>
  );
}
