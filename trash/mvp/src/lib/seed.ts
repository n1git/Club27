import type { Database } from "@/types/db";

function id(): string {
  return crypto.randomUUID();
}

export function seedDatabase(): Database {
  const now = new Date().toISOString();
  const today = new Date();

  const adminId = id();
  const coach1Id = id();
  const coach2Id = id();
  const parent1Id = id();
  const parent2Id = id();

  const locationId = id();
  const classTypeId = id();
  const classTypeId2 = id();

  const child1Id = id();
  const child2Id = id();
  const child3Id = id();

  const packageId = id();

  const classId = id();

  const subscriptionId = id();

  function isoAt(daysOffset: number, hour: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  return {
    version: 1,
    profiles: [
      { id: adminId, role: "admin", fullName: "Admin Demo", email: "admin@demo.dev", isActive: true, mustChangePassword: false, createdAt: now },
      { id: coach1Id, role: "coach", fullName: "Coach Budi", email: "coach1@demo.dev", isActive: true, mustChangePassword: false, createdAt: now },
      { id: coach2Id, role: "coach", fullName: "Coach Sari", email: "coach2@demo.dev", isActive: true, mustChangePassword: false, createdAt: now },
      { id: parent1Id, role: "parent", fullName: "Ibu Dewi", email: "parent1@demo.dev", isActive: true, mustChangePassword: false, createdAt: now },
      { id: parent2Id, role: "parent", fullName: "Bapak Andi", email: "parent2@demo.dev", isActive: true, mustChangePassword: false, createdAt: now },
    ],
    authCredentials: [
      { profileId: adminId, password: "admin123" },
      { profileId: coach1Id, password: "coach123" },
      { profileId: coach2Id, password: "coach123" },
      { profileId: parent1Id, password: "parent123" },
      { profileId: parent2Id, password: "parent123" },
    ],
    locations: [{ id: locationId, name: "Kolam Utama", address: "Jl. Renang No. 1" }],
    classTypes: [
      { id: classTypeId, name: "Renang Dasar", description: "Untuk pemula" },
      { id: classTypeId2, name: "Renang Lanjutan", description: "Untuk yang sudah bisa berenang" },
    ],
    children: [
      { id: child1Id, parentId: parent1Id, fullName: "Kirana", dateOfBirth: "2017-03-12", preferredLocationId: locationId, isActive: true, createdAt: now },
      { id: child2Id, parentId: parent2Id, fullName: "Bima", dateOfBirth: "2016-08-05", preferredLocationId: locationId, isActive: true, createdAt: now },
      { id: child3Id, parentId: parent2Id, fullName: "Citra", dateOfBirth: "2019-01-20", preferredLocationId: locationId, isActive: true, createdAt: now },
    ],
    classes: [
      { id: classId, instructorId: coach1Id, locationId, classTypeId, startTime: isoAt(1, 9), endTime: isoAt(1, 10), capacity: 6, createdAt: now },
    ],
    bookings: [
      { id: id(), childId: child1Id, classId, isAttended: false, createdAt: now },
      { id: id(), childId: child2Id, classId, isAttended: false, createdAt: now },
    ],
    membershipPackages: [
      { id: packageId, name: "Paket Bulanan", price: 500000, billingCycle: "monthly", description: "4x pertemuan per bulan", isActive: true },
    ],
    subscriptions: [{ id: subscriptionId, childId: child1Id, packageId, status: "active", startDate: periodStart }],
    invoices: [
      {
        id: id(),
        childId: child1Id,
        subscriptionId,
        amount: 500000,
        status: "outstanding",
        dueDate: periodEnd,
        periodStart,
        periodEnd,
      },
    ],
    cashLedger: [],
    payrollRuns: [],
    promo: [
      {
        id: id(),
        title: "Promo Pendaftaran Baru",
        body: "Diskon 10% untuk pendaftaran anggota baru bulan ini.",
        activeFrom: now,
        authorId: adminId,
        createdAt: now,
      },
    ],
  };
}
