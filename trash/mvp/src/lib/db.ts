import type {
  Booking,
  CashLedgerEntry,
  Child,
  ClassType,
  Database,
  Invoice,
  Location,
  MembershipPackage,
  PayrollRun,
  Profile,
  Promo,
  Result,
  Subscription,
  SwimClass,
} from "@/types/db";
import { seedDatabase } from "./seed";

const STORAGE_KEY = "swimma_mvp_db_v1";

export function genId(): string {
  return crypto.randomUUID();
}

function loadDb(): Database {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedDatabase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(raw) as Database;
}

function saveDb(db: Database): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function withDb<T>(fn: (db: Database) => T): T {
  const db = loadDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

export function resetDatabase(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getProfile(id: string): Profile | undefined {
  return loadDb().profiles.find((p) => p.id === id);
}

export function listProfilesByRole(role: Profile["role"]): Profile[] {
  return loadDb().profiles.filter((p) => p.role === role);
}

export function findProfileByEmail(email: string): Profile | undefined {
  return loadDb().profiles.find((p) => p.email === email);
}

export function getCredential(profileId: string) {
  return loadDb().authCredentials.find((c) => c.profileId === profileId);
}

export function updateProfile(id: string, patch: Partial<Profile>): void {
  withDb((db) => {
    const profile = db.profiles.find((p) => p.id === id);
    if (profile) Object.assign(profile, patch);
  });
}

export function createAccount(input: {
  role: Profile["role"];
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}): Result<Profile> {
  return withDb((db) => {
    if (db.profiles.some((p) => p.email === input.email)) {
      return { ok: false, error: "Email sudah terdaftar" };
    }
    const profile: Profile = {
      id: genId(),
      role: input.role,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    db.profiles.push(profile);
    db.authCredentials.push({ profileId: profile.id, password: input.password });
    return { ok: true, data: profile };
  });
}

export function listLocations(): Location[] {
  return loadDb().locations;
}

export function createLocation(name: string, address?: string): void {
  withDb((db) => db.locations.push({ id: genId(), name, address }));
}

export function listClassTypes(): ClassType[] {
  return loadDb().classTypes;
}

export function createClassType(name: string, description?: string): void {
  withDb((db) => db.classTypes.push({ id: genId(), name, description }));
}

export function listChildren(): Child[] {
  return loadDb().children;
}

export function getChild(id: string): Child | undefined {
  return loadDb().children.find((c) => c.id === id);
}

export function listChildrenByParent(parentId: string): Child[] {
  return loadDb().children.filter((c) => c.parentId === parentId);
}

export function createChild(input: Omit<Child, "id" | "isActive" | "createdAt">): Child {
  return withDb((db) => {
    const child: Child = {
      ...input,
      id: genId(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db.children.push(child);
    return child;
  });
}

export function updateChild(id: string, patch: Partial<Child>): void {
  withDb((db) => {
    const child = db.children.find((c) => c.id === id);
    if (child) Object.assign(child, patch);
  });
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const distance = levenshtein(na, nb);
  return 1 - distance / Math.max(na.length, nb.length);
}

export interface DuplicateChildMatch {
  id: string;
  fullName: string;
  dateOfBirth: string;
  parentName: string;
  similarity: number;
}

export function searchSimilarChildren(fullName: string, dateOfBirth: string): DuplicateChildMatch[] {
  const db = loadDb();
  if (!fullName.trim()) return [];
  return db.children
    .filter((c) => c.isActive)
    .map((c) => {
      const sameDob = dateOfBirth ? c.dateOfBirth === dateOfBirth : false;
      const similarity = Math.max(nameSimilarity(c.fullName, fullName), sameDob ? 1 : 0);
      const parent = db.profiles.find((p) => p.id === c.parentId);
      return {
        id: c.id,
        fullName: c.fullName,
        dateOfBirth: c.dateOfBirth,
        parentName: parent?.fullName ?? "-",
        similarity,
      };
    })
    .filter((m) => m.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export function listClasses(): SwimClass[] {
  return loadDb().classes;
}

export function listClassesByInstructor(instructorId: string): SwimClass[] {
  return loadDb().classes.filter((c) => c.instructorId === instructorId);
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function createClass(
  input: Omit<SwimClass, "id" | "createdAt">
): Result<SwimClass> {
  if (new Date(input.endTime) <= new Date(input.startTime)) {
    return { ok: false, error: "Waktu selesai harus setelah waktu mulai" };
  }
  return withDb((db) => {
    const overlapping = db.classes.some(
      (c) =>
        c.instructorId === input.instructorId &&
        rangesOverlap(c.startTime, c.endTime, input.startTime, input.endTime)
    );
    if (overlapping) {
      return { ok: false, error: "Pelatih sudah memiliki kelas lain pada waktu tersebut" };
    }
    const swimClass: SwimClass = { ...input, id: genId(), createdAt: new Date().toISOString() };
    db.classes.push(swimClass);
    return { ok: true, data: swimClass };
  });
}

export function deleteClass(classId: string): void {
  withDb((db) => {
    db.classes = db.classes.filter((c) => c.id !== classId);
    db.bookings = db.bookings.filter((b) => b.classId !== classId);
  });
}

export function listBookingsByClass(classId: string): Booking[] {
  return loadDb().bookings.filter((b) => b.classId === classId);
}

export function listBookingsByChild(childId: string): Booking[] {
  return loadDb().bookings.filter((b) => b.childId === childId);
}

export function createBooking(childId: string, classId: string): Result<Booking> {
  return withDb((db) => {
    const swimClass = db.classes.find((c) => c.id === classId);
    if (!swimClass) return { ok: false, error: "Kelas tidak ditemukan" };
    if (db.bookings.some((b) => b.childId === childId && b.classId === classId)) {
      return { ok: false, error: "Anak ini sudah terdaftar di kelas ini" };
    }
    const count = db.bookings.filter((b) => b.classId === classId).length;
    if (count >= swimClass.capacity) {
      return { ok: false, error: "Kelas sudah penuh" };
    }
    const booking: Booking = {
      id: genId(),
      childId,
      classId,
      isAttended: false,
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    return { ok: true, data: booking };
  });
}

export function removeBooking(bookingId: string): void {
  withDb((db) => {
    db.bookings = db.bookings.filter((b) => b.id !== bookingId);
  });
}

export function markAttendance(bookingId: string, isAttended: boolean): void {
  withDb((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.isAttended = isAttended;
      booking.attendedAt = isAttended ? new Date().toISOString() : undefined;
    }
  });
}

export function updateBookingNotes(bookingId: string, notes: string): void {
  withDb((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.notes = notes.trim() || undefined;
    }
  });
}

export function listPackages(): MembershipPackage[] {
  return loadDb().membershipPackages;
}

export function createPackage(input: Omit<MembershipPackage, "id" | "isActive">): void {
  withDb((db) => db.membershipPackages.push({ ...input, id: genId(), isActive: true }));
}

export function listSubscriptions(): Subscription[] {
  return loadDb().subscriptions;
}

export function listSubscriptionsByChild(childId: string): Subscription[] {
  return loadDb().subscriptions.filter((s) => s.childId === childId);
}

export function createSubscription(childId: string, packageId: string, startDate: string): Result<Subscription> {
  return withDb((db) => {
    if (db.subscriptions.some((s) => s.childId === childId && s.status === "active")) {
      return { ok: false, error: "Anak ini sudah memiliki langganan aktif" };
    }
    const subscription: Subscription = { id: genId(), childId, packageId, status: "active", startDate };
    db.subscriptions.push(subscription);
    return { ok: true, data: subscription };
  });
}

export function cancelSubscription(subscriptionId: string): void {
  withDb((db) => {
    const subscription = db.subscriptions.find((s) => s.id === subscriptionId);
    if (subscription) {
      subscription.status = "cancelled";
      subscription.endDate = new Date().toISOString().slice(0, 10);
    }
  });
}

export function listInvoices(): Invoice[] {
  return loadDb().invoices;
}

export function listInvoicesByChild(childId: string): Invoice[] {
  return loadDb().invoices.filter((i) => i.childId === childId);
}

export function generateInvoices(periodStart: string, periodEnd: string, dueDate: string): number {
  return withDb((db) => {
    let created = 0;
    for (const subscription of db.subscriptions) {
      if (subscription.status !== "active") continue;
      const exists = db.invoices.some(
        (i) => i.subscriptionId === subscription.id && i.periodStart === periodStart
      );
      if (exists) continue;
      const pkg = db.membershipPackages.find((p) => p.id === subscription.packageId);
      if (!pkg) continue;
      db.invoices.push({
        id: genId(),
        childId: subscription.childId,
        subscriptionId: subscription.id,
        amount: pkg.price,
        status: "outstanding",
        dueDate,
        periodStart,
        periodEnd,
      });
      created++;
    }
    return created;
  });
}

export function markInvoicePaid(invoiceId: string, createdBy: string): Result<void> {
  return withDb((db) => {
    const invoice = db.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.status !== "outstanding") {
      return { ok: false, error: "Tagihan tidak ditemukan atau sudah selesai" };
    }
    invoice.status = "paid";
    invoice.paidAt = new Date().toISOString();
    db.cashLedger.push({
      id: genId(),
      entryDate: new Date().toISOString(),
      category: "payment_received",
      direction: "in",
      amount: invoice.amount,
      invoiceId: invoice.id,
      createdBy,
    });
    return { ok: true, data: undefined };
  });
}

export function voidInvoice(invoiceId: string): void {
  withDb((db) => {
    const invoice = db.invoices.find((i) => i.id === invoiceId && i.status === "outstanding");
    if (invoice) invoice.status = "void";
  });
}

export interface LedgerEntryWithBalance extends CashLedgerEntry {
  runningBalance: number;
}

export function listLedgerWithBalance(): LedgerEntryWithBalance[] {
  const entries = [...loadDb().cashLedger].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  let balance = 0;
  return entries.map((entry) => {
    balance += entry.direction === "in" ? entry.amount : -entry.amount;
    return { ...entry, runningBalance: balance };
  });
}

export function addManualAdjustment(
  direction: "in" | "out",
  amount: number,
  reason: string,
  createdBy: string
): Result<void> {
  if (!reason.trim()) return { ok: false, error: "Alasan wajib diisi" };
  if (amount <= 0) return { ok: false, error: "Jumlah harus lebih dari 0" };
  return withDb((db) => {
    db.cashLedger.push({
      id: genId(),
      entryDate: new Date().toISOString(),
      category: "manual_adjustment",
      direction,
      amount,
      reason,
      createdBy,
    });
    return { ok: true, data: undefined };
  });
}

export function listPayrollRuns(): PayrollRun[] {
  return loadDb().payrollRuns;
}

export function createPayrollRun(input: {
  coachId: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  bonus: number;
  thr: number;
  createdBy: string;
}): Result<PayrollRun> {
  return withDb((db) => {
    const duplicate = db.payrollRuns.some(
      (r) =>
        r.coachId === input.coachId &&
        r.periodStart === input.periodStart &&
        r.periodEnd === input.periodEnd
    );
    if (duplicate) {
      return { ok: false, error: "Gaji untuk pelatih dan periode ini sudah pernah dibuat" };
    }
    const totalAmount = input.baseSalary + input.bonus + input.thr;
    const run: PayrollRun = {
      id: genId(),
      coachId: input.coachId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      baseSalary: input.baseSalary,
      bonus: input.bonus,
      thr: input.thr,
      totalAmount,
      status: "posted",
      postedAt: new Date().toISOString(),
    };
    db.payrollRuns.push(run);
    const ledgerEntry: CashLedgerEntry = {
      id: genId(),
      entryDate: new Date().toISOString(),
      category: "payroll",
      direction: "out",
      amount: totalAmount,
      payrollRunId: run.id,
      createdBy: input.createdBy,
    };
    db.cashLedger.push(ledgerEntry);
    run.cashLedgerEntryId = ledgerEntry.id;
    return { ok: true, data: run };
  });
}

export function listPromo(): Promo[] {
  return loadDb().promo;
}

export function listActivePromo(): Promo[] {
  const now = new Date().toISOString();
  return loadDb().promo.filter((p) => p.activeFrom <= now && (!p.activeUntil || p.activeUntil >= now));
}

export function createPromo(input: Omit<Promo, "id" | "createdAt">): void {
  withDb((db) => db.promo.push({ ...input, id: genId(), createdAt: new Date().toISOString() }));
}

export function deletePromo(promoId: string): void {
  withDb((db) => {
    db.promo = db.promo.filter((p) => p.id !== promoId);
  });
}

export function getReports() {
  const db = loadDb();
  const paidInvoices = db.invoices.filter((i) => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
  const outstanding = db.invoices.filter((i) => i.status === "outstanding");
  const outstandingAmount = outstanding.reduce((sum, i) => sum + i.amount, 0);
  const totalPayrollCost = db.payrollRuns
    .filter((r) => r.status === "posted")
    .reduce((sum, r) => sum + r.totalAmount, 0);
  const activeChildren = db.children.filter((c) => c.isActive).length;
  const inactiveChildren = db.children.filter((c) => !c.isActive).length;

  const revenueByProgram = db.membershipPackages.map((pkg) => {
    const revenue = paidInvoices
      .filter((i) => db.subscriptions.find((s) => s.id === i.subscriptionId)?.packageId === pkg.id)
      .reduce((sum, i) => sum + i.amount, 0);
    return { packageName: pkg.name, revenue };
  });

  const monthKey = (iso: string) => iso.slice(0, 7);
  const months = new Set<string>();
  db.cashLedger.forEach((e) => months.add(monthKey(e.entryDate)));
  const cashFlow = Array.from(months)
    .sort()
    .map((month) => {
      const entries = db.cashLedger.filter((e) => monthKey(e.entryDate) === month);
      const cashIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
      const cashOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
      return { month, cashIn, cashOut, net: cashIn - cashOut };
    });

  return {
    totalRevenue,
    outstandingCount: outstanding.length,
    outstandingAmount,
    totalPayrollCost,
    activeChildren,
    inactiveChildren,
    revenueByProgram,
    cashFlow,
  };
}
