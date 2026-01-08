import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DashboardProvider } from "@/contexts/DashboardContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import Importacoes from "./pages/Importacoes";
import Leads from "./pages/Leads";
import CBOsBloqueados from "./pages/CBOsBloqueados";
import Alertas from "./pages/Alertas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper que inclui o DashboardProvider para rotas protegidas
const ProtectedWithDashboard = ({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) => (
  <ProtectedRoute requireAdmin={requireAdmin}>
    <DashboardProvider>
      {children}
    </DashboardProvider>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedWithDashboard>
                  <Dashboard />
                </ProtectedWithDashboard>
              }
            />
            <Route
              path="/dashboard/users"
              element={
                <ProtectedWithDashboard requireAdmin>
                  <UserManagement />
                </ProtectedWithDashboard>
              }
            />
            <Route
              path="/dashboard/importacoes"
              element={
                <ProtectedWithDashboard>
                  <Importacoes />
                </ProtectedWithDashboard>
              }
            />
            <Route
              path="/dashboard/leads"
              element={
                <ProtectedWithDashboard>
                  <Leads />
                </ProtectedWithDashboard>
              }
            />
            <Route
              path="/dashboard/cbos-bloqueados"
              element={
                <ProtectedWithDashboard>
                  <CBOsBloqueados />
                </ProtectedWithDashboard>
              }
            />
            <Route
              path="/dashboard/alertas"
              element={
                <ProtectedWithDashboard>
                  <Alertas />
                </ProtectedWithDashboard>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
