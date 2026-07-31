import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { DataProvider } from '@/store/DataContext'
import { AuthProvider } from '@/features/auth/AuthContext'
import { AuthGate } from '@/features/auth/AuthGate'
import { AppLayout } from '@/layouts/AppLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { PurchaseOrdersPage } from '@/pages/purchase-orders/PurchaseOrdersPage'
import { PODetailPage } from '@/pages/purchase-orders/PODetailPage'
import { VendorsPage } from '@/pages/vendors/VendorsPage'
import { VendorDetailPage } from '@/pages/vendors/VendorDetailPage'
import { PatientsPage } from '@/pages/patients/PatientsPage'
import { PatientProfilePage } from '@/pages/patients/PatientProfilePage'
import { CasesPage } from '@/pages/cases/CasesPage'
import { CaseDetailPage } from '@/pages/cases/CaseDetailPage'
import { LabsPage } from '@/pages/labs/LabsPage'
import { LabDetailPage } from '@/pages/labs/LabDetailPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { SaleDetailPage } from '@/pages/sales/SaleDetailPage'
import { LoansPage } from '@/pages/loans/LoansPage'
import { LoanDetailPage } from '@/pages/loans/LoanDetailPage'
import { LoanReturnsPage } from '@/pages/loan-returns/LoanReturnsPage'
import { BatchesPage } from '@/pages/batches/BatchesPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { UsersPage } from '@/pages/users/UsersPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <AuthProvider>
          <AuthGate>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="/purchase-orders/:poId" element={<PODetailPage />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/vendors/:vendorId" element={<VendorDetailPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:patientId" element={<PatientProfilePage />} />
                <Route path="/cases" element={<CasesPage />} />
                <Route path="/cases/:caseId" element={<CaseDetailPage />} />
                <Route path="/labs" element={<LabsPage />} />
                <Route path="/labs/:labId" element={<LabDetailPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/:saleId" element={<SaleDetailPage />} />
                <Route path="/loans" element={<LoansPage />} />
                <Route path="/loans/:loanId" element={<LoanDetailPage />} />
                <Route path="/loan-returns" element={<LoanReturnsPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </AuthGate>
        </AuthProvider>
      </DataProvider>
    </ThemeProvider>
  )
}

export default App
