import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const SkeletonKPICard = () => (
  <Card className="bg-card border-l-4 border-l-muted border-t-0 border-r-0 border-b-0">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

export const SkeletonChart = () => (
  <Card className="bg-card border-border">
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-48" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[300px] w-full" />
    </CardContent>
  </Card>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <Card className="bg-card border-border">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex gap-3 mt-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {/* Header row */}
        <div className="grid grid-cols-7 gap-4 pb-2 border-b border-border">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        {/* Data rows */}
        {[...Array(rows)].map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 gap-4 py-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const SkeletonDashboard = () => (
  <div className="space-y-6">
    {/* KPI Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <SkeletonKPICard key={i} />
      ))}
    </div>
    
    {/* Secondary KPIs */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <SkeletonKPICard key={i} />
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonChart />
      <SkeletonChart />
    </div>
  </div>
);