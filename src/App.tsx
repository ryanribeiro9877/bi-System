import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { DashboardProvider, DashboardProviderNoLeads } from "@/contexts/DashboardContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { queryClient } from "@/lib/queryClient";

const Index = lazy(() => import("./pages/Index"));
const Consultas = lazy(() => import("./pages/Consultas"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Importacoes = lazy(() => import("./pages/Importacoes"));
const Leads = lazy(() => import("./pages/Leads"));
const CBOsBloqueados = lazy(() => import("./pages/CBOsBloqueados"));
const Alertas = lazy(() => import("./pages/Alertas"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Wrapper que inclui o DashboardProvider para rotas protegidas
const ProtectedWithDashboard = ({
  children,
  requireAdmin = false,
  enableLeadsQuery = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  enableLeadsQuery?: boolean;
}) => (
  <ProtectedRoute requireAdmin={requireAdmin}>
    {enableLeadsQuery ? <DashboardProvider>{children}</DashboardProvider> : <DashboardProviderNoLeads>{children}</DashboardProviderNoLeads>}
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedWithDashboard>
                    <Consultas />
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
                  <ProtectedWithDashboard enableLeadsQuery>
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
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedWithDashboard>
                    <Dashboard />
                  </ProtectedWithDashboard>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
