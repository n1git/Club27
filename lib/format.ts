const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getJakartaDateString(date: Date = new Date()): string {
  const jakartaMs = date.getTime() + JAKARTA_OFFSET_MS;
  return new Date(jakartaMs).toISOString().slice(0, 10);
}

export function getJakartaDayRangeIso(date: Date = new Date()): { start: string; end: string } {
  const dayString = getJakartaDateString(date);
  const startUtcMs = new Date(`${dayString}T00:00:00.000Z`).getTime() - JAKARTA_OFFSET_MS;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs).toISOString(), end: new Date(endUtcMs).toISOString() };
}

export function getJakartaLocalInputNow(): string {
  return new Date(Date.now() + JAKARTA_OFFSET_MS).toISOString().slice(0, 16);
}

export function getJakartaMonthBounds(date: Date = new Date()): { start: string; end: string } {
  const [year, month] = getJakartaDateString(date).split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function formatJakartaDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("id-ID", { timeZone: JAKARTA_TIME_ZONE });
}

export function formatJakartaTime(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(value).toLocaleTimeString("id-ID", { timeZone: JAKARTA_TIME_ZONE, ...options });
}

export function formatJakartaDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(value).toLocaleDateString("id-ID", { timeZone: JAKARTA_TIME_ZONE, ...options });
}

export function parseJakartaLocalInput(value: string): string {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+07:00`).toISOString();
}

export function formatRupiahCompact(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { notation: "compact" }).format(value)}`;
}

export function formatRupiahFull(value: number | string | readonly (number | string)[] | undefined): string {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

export function formatRelativeShort(value: string | Date, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari`;
  if (days < 35) return `${Math.floor(days / 7)} mgg`;
  return formatJakartaDate(value, { day: "numeric", month: "short", year: "numeric" });
}
