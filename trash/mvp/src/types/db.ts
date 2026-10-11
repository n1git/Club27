export type AppRole = "admin" | "coach" | "parent";

export interface Profile {
  id: string;
  role: AppRole;
  fullName: string;
  phone?: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AuthCredential {
  profileId: string;
  password: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
}

export interface ClassType {
  id: string;
  name: string;
  description?: string;
}

export interface Child {
  id: string;
  parentId: string;
  fullName: string;
  dateOfBirth: string;
  notes?: string;
  address?: string;
  preferredLocationId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SwimClass {
  id: string;
  instructorId: string;
  locationId: string;
  classTypeId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  createdAt: string;
}

export interface Booking {
  id: string;
  childId: string;
  classId: string;
  isAttended: boolean;
  attendedAt?: string;
  notes?: string;
  createdAt: string;
}

export type BillingCycle = "monthly" | "quarterly" | "yearly";

export interface MembershipPackage {
  id: string;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  description?: string;
  isActive: boolean;
}

export type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

export interface Subscription {
  id: string;
  childId: string;
  packageId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string;
}

export type InvoiceStatus = "outstanding" | "paid" | "void";

export interface Invoice {
  id: string;
  childId: string;
  subscriptionId: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
}

export type LedgerCategory = "payment_received" | "payroll" | "manual_adjustment";
export type LedgerDirection = "in" | "out";

export interface CashLedgerEntry {
  id: string;
  entryDate: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amount: number;
  invoiceId?: string;
  payrollRunId?: string;
  reason?: string;
  createdBy: string;
}

export type PayrollStatus = "draft" | "posted";

export interface PayrollRun {
  id: string;
  coachId: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  bonus: number;
  thr: number;
  totalAmount: number;
  status: PayrollStatus;
  postedAt?: string;
  cashLedgerEntryId?: string;
}

export interface Promo {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  activeFrom: string;
  activeUntil?: string;
  authorId: string;
  createdAt: string;
}

export interface Database {
  version: number;
  profiles: Profile[];
  authCredentials: AuthCredential[];
  locations: Location[];
  classTypes: ClassType[];
  children: Child[];
  classes: SwimClass[];
  bookings: Booking[];
  membershipPackages: MembershipPackage[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  cashLedger: CashLedgerEntry[];
  payrollRuns: PayrollRun[];
  promo: Promo[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
