export function formatRupiah(value: number): string {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID");
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID");
}

export function formatMonth(iso: string): string {
  const [year, month] = iso.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}
