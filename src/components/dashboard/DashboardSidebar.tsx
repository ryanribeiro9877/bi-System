import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, LayoutDashboard, LogOut, Users, UserPlus, UserX, Upload, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import ImportFileFilter from "./ImportFileFilter";

const DashboardSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin, user } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Leads", path: "/dashboard/leads" },
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

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sidebar-foreground">BI Leads CLT</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Admin" : "Usuário"}
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-6 py-4 border-b border-sidebar-border">
        <p className="text-xs text-muted-foreground">Logado como:</p>
        <p className="text-sm text-sidebar-foreground truncate">{user?.email}</p>
      </div>

      {/* Filtro por Arquivo Importado */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <p className="text-xs text-muted-foreground mb-2">Filtrar por arquivo:</p>
        <ImportFileFilter />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={`w-full justify-start gap-3 h-11 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
