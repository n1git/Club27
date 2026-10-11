import { Link } from "react-router-dom";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
