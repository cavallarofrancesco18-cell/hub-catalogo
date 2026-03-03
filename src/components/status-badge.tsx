import type { Vehicle } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: Vehicle['stato'];
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (status === 'Pubblicato') {
    return null;
  }

  const badgeVariant = status === 'Venduto' ? 'destructive' : 'secondary';
  const customClass = status === 'Opzionato' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50' : '';

  return (
    <Badge variant={badgeVariant} className={cn('absolute top-3 right-3', customClass, className)}>
      {status}
    </Badge>
  );
}
