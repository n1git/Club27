import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { RequireRole } from "@/routes/RequireRole";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CoachLayout } from "@/components/layout/CoachLayout";
import { ParentLayout } from "@/components/layout/ParentLayout";
import LoginPage from "@/pages/LoginPage";
import RootRedirect from "@/pages/RootRedirect";

import AdminDashboardPage from "@/pages/admin/DashboardPage";
import AdminMembersPage from "@/pages/admin/MembersPage";
import AdminMemberNewPage from "@/pages/admin/MemberNewPage";
import AdminMemberDetailPage from "@/pages/admin/MemberDetailPage";
import AdminCoachesPage from "@/pages/admin/CoachesPage";
import AdminCoachNewPage from "@/pages/admin/CoachNewPage";
import AdminCoachDetailPage from "@/pages/admin/CoachDetailPage";
import AdminSchedulePage from "@/pages/admin/SchedulePage";
import AdminClassNewPage from "@/pages/admin/ClassNewPage";
import AdminClassDetailPage from "@/pages/admin/ClassDetailPage";
import AdminPackagesPage from "@/pages/admin/PackagesPage";
import AdminSubscriptionsPage from "@/pages/admin/SubscriptionsPage";
import AdminInvoicesPage from "@/pages/admin/InvoicesPage";
import AdminCashLedgerPage from "@/pages/admin/CashLedgerPage";
import AdminPayrollPage from "@/pages/admin/PayrollPage";
import AdminPromoPage from "@/pages/admin/PromoPage";
import AdminReportsPage from "@/pages/admin/ReportsPage";
import AdminSettingsPage from "@/pages/admin/SettingsPage";

import CoachSchedulePage from "@/pages/coach/SchedulePage";
import CoachAttendancePage from "@/pages/coach/AttendancePage";

import ParentSchedulePage from "@/pages/parent/SchedulePage";
import ParentBillingPage from "@/pages/parent/BillingPage";
import ParentPromoPage from "@/pages/parent/PromoPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/admin" element={<RequireRole role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="members" element={<AdminMembersPage />} />
            <Route path="members/new" element={<AdminMemberNewPage />} />
            <Route path="members/:id" element={<AdminMemberDetailPage />} />
            <Route path="coaches" element={<AdminCoachesPage />} />
            <Route path="coaches/new" element={<AdminCoachNewPage />} />
            <Route path="coaches/:id" element={<AdminCoachDetailPage />} />
            <Route path="schedule" element={<AdminSchedulePage />} />
            <Route path="schedule/new" element={<AdminClassNewPage />} />
            <Route path="schedule/:id" element={<AdminClassDetailPage />} />
            <Route path="billing/packages" element={<AdminPackagesPage />} />
            <Route path="billing/subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="billing/invoices" element={<AdminInvoicesPage />} />
            <Route path="cash-ledger" element={<AdminCashLedgerPage />} />
            <Route path="payroll" element={<AdminPayrollPage />} />
            <Route path="promo" element={<AdminPromoPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>

        <Route path="/coach" element={<RequireRole role="coach" />}>
          <Route element={<CoachLayout />}>
            <Route index element={<CoachSchedulePage />} />
            <Route path="attendance/:classId" element={<CoachAttendancePage />} />
          </Route>
        </Route>

        <Route path="/parent" element={<RequireRole role="parent" />}>
          <Route element={<ParentLayout />}>
            <Route index element={<ParentSchedulePage />} />
            <Route path="billing" element={<ParentBillingPage />} />
            <Route path="promo" element={<ParentPromoPage />} />
          </Route>
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </HashRouter>
  );
}
