import { LucideIcon, Maximize2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  expandable?: boolean;
  onExpand?: () => void;
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

const KPICard = ({ title, value, subtitle, icon: Icon, trend, variant = "default", expandable, onExpand }: KPICardProps) => {
  return (
    <Card className={`glass-card bg-gradient-to-br ${variantStyles[variant]} overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
      <CardContent className="p-4 lg:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 lg:space-y-2 flex-1 min-w-0">
            <p className="text-xs lg:text-sm font-medium text-muted-foreground line-clamp-2">{title}</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">{value}</p>
            {subtitle && (
              <p className="text-xs lg:text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-xs lg:text-sm ${trend.isPositive ? "text-success" : "text-destructive"}`}>
                <span>{trend.isPositive ? "↑" : "↓"}</span>
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className={`p-2 lg:p-3 rounded-xl ${iconStyles[variant]} transition-transform group-hover:scale-110`}>
              <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            {expandable && onExpand && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onExpand}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KPICard;
