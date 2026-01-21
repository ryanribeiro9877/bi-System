import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, LayoutDashboard, LogOut, Users, UserPlus, UserX, Upload, Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import ImportFileFilter from "./ImportFileFilter";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const DashboardSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fecha o menu mobile ao mudar de rota
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { icon: LayoutDashboard, label: "Consultas", path: "/dashboard" },
    { icon: Users, label: "Contratos Digitados", path: "/dashboard/leads" },
    { icon: UserX, label: "CBOs Bloqueados", path: "/dashboard/cbos-bloqueados" },
    { icon: Upload, label: "Importações", path: "/dashboard/importacoes" },
    { icon: Bell, label: "Alertas", path: "/dashboard/alertas" },
  ];

  // Only show user management for admin
  if (isAdmin) {
    menuItems.push({ icon: UserPlus, label: "Gerenciar Usuários", path: "/dashboard/users" });
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sidebar-foreground text-sm lg:text-base truncate">BI de Consultas</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Admin" : "Usuário"}
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-sidebar-border">
        <p className="text-xs text-muted-foreground">Logado como:</p>
        <p className="text-sm text-sidebar-foreground truncate">{user?.email}</p>
      </div>

      {/* Filtro por Arquivo Importado */}
      <div className="px-3 lg:px-4 py-3 border-b border-sidebar-border">
        <p className="text-xs text-muted-foreground mb-2">Filtrar por arquivo:</p>
        <ImportFileFilter />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={`w-full justify-start gap-2 lg:gap-3 h-10 lg:h-11 text-sm ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 lg:p-4 border-t border-sidebar-border mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 lg:gap-3 h-10 lg:h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header com Menu Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-sidebar-foreground text-sm">BI de Consultas</h1>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
            <div className="flex flex-col h-full">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>
    </>
  );
};

export default DashboardSidebar;
