"use client";

import { Button } from "@/components/ui/button";

export function SuperadminLogoutButton() {
  async function handleLogout() {
    await fetch("/api/superadmin/logout", { method: "POST" });
    window.location.assign("/superadmin/login");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Keluar
    </Button>
  );
}
