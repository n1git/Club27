import { Navigate, Outlet } from "react-router-dom";
import { getSession, ROLE_HOME } from "@/lib/auth";
import type { AppRole } from "@/types/db";

export function RequireRole({ role }: { role: AppRole }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={ROLE_HOME[session.role]} replace />;
  return <Outlet />;
}
