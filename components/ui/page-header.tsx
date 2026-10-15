import { Breadcrumb, type Crumb } from "./breadcrumb";

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumb?: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      <Breadcrumb items={breadcrumb} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl uppercase leading-none tracking-tight sm:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
