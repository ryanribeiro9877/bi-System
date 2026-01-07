import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "from-primary/20 to-primary/5 border-primary/20",
  success: "from-success/20 to-success/5 border-success/20",
  warning: "from-warning/20 to-warning/5 border-warning/20",
  danger: "from-destructive/20 to-destructive/5 border-destructive/20",
};

const iconStyles = {
  default: "bg-primary/20 text-primary",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-destructive/20 text-destructive",
};

const KPICard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: KPICardProps) => {
  return (
    <Card className={`glass-card bg-gradient-to-br ${variantStyles[variant]} overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-sm ${trend.isPositive ? "text-success" : "text-destructive"}`}>
                <span>{trend.isPositive ? "↑" : "↓"}</span>
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${iconStyles[variant]} transition-transform group-hover:scale-110`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KPICard;
