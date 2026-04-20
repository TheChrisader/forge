import {
  DatabaseIcon,
  HardDriveIcon,
  ListIcon,
  Search as SearchIcon,
  BarChart3Icon,
  SettingsIcon,
  PackageIcon,
  type LucideIcon,
} from "lucide-react";
import type { ServiceType } from "@forge/types";
import { cn } from "@/shared/lib/utils";

const typeIcons: Record<string, LucideIcon> = {
  DATABASE: DatabaseIcon,
  CACHE: HardDriveIcon,
  QUEUE: ListIcon,
  STORAGE: PackageIcon,
  SEARCH: SearchIcon,
  MONITORING: BarChart3Icon,
  CUSTOM: SettingsIcon,
};

interface ServiceTypeIconProps {
  type: ServiceType;
  className?: string;
}

export function ServiceTypeIcon({ type, className }: ServiceTypeIconProps): React.ReactElement {
  const Icon = typeIcons[type] ?? SettingsIcon;

  return <Icon className={cn("h-4 w-4", className)} />;
}
