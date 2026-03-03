import type { Vehicle } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: Vehicle['stato'];
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (status !== 'Venduto') {
    return null;
  }

  return (
    <Badge variant="destructive" className={cn('absolute top-3 right-3', className)}>
      {status}
    </Badge>
  );
}
