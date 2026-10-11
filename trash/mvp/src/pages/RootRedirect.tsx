import { Navigate } from "react-router-dom";
import { getSession, ROLE_HOME } from "@/lib/auth";

export default function RootRedirect() {
  const session = getSession();
  return <Navigate to={session ? ROLE_HOME[session.role] : "/login"} replace />;
}
