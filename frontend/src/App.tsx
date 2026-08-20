import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VerifyEmail from './pages/VerifyEmail';
import LoanApplicationForm from './pages/LoanApplicationForm';
import CustomerHistory from './pages/CustomerHistory';
import CustomerVerification from './pages/CustomerVerification';
import CustomerDocuments from './pages/CustomerDocuments';
import CurrentLoanRedirect from './pages/CurrentLoanRedirect';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminApplicationReview } from './pages/admin/AdminApplicationReview';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        
        {/* Customer Portal Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <CustomerHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <CustomerHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/current-loan"
          element={
            <ProtectedRoute>
              <CurrentLoanRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute>
              <CustomerVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <CustomerDocuments />
            </ProtectedRoute>
          }
        />

        {/* Loan Flow Routes */}
        <Route
          path="/loans/new"
          element={
            <ProtectedRoute>
              <LoanApplicationForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loans/:id"
          element={
            <ProtectedRoute>
              <LoanApplicationForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loans/:id/verification"
          element={
            <ProtectedRoute>
              <LoanApplicationForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/:id/verification"
          element={
            <ProtectedRoute>
              <LoanApplicationForm />
            </ProtectedRoute>
          }
        />

        {/* Admin Underwriting Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/applications/:id"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminApplicationReview />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
