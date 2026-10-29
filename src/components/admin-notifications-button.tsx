'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { Bell, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

import { useCollection } from '@/firebase';
import { useFirestore, useMemoFirebase, useUserRole } from '@/firebase';
import type { AdminReservationNotification } from '@/lib/admin-notifications';
import { ADMIN_NOTIFICATION_COLLECTION } from '@/lib/admin-notifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function formatNotificationTime(value: unknown) {
  if (!value) return 'Adesso';
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, 'dd/MM HH:mm');
    }
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return format(maybeTimestamp.toDate(), 'dd/MM HH:mm');
    }
  }
  return 'Adesso';
}

export function AdminNotificationsButton({ className }: { className?: string }) {
  const { isPlatformAdmin } = useUserRole();
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !isPlatformAdmin) {
      return null;
    }

    return query(
      collection(firestore, ADMIN_NOTIFICATION_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(8)
    );
  }, [firestore, isPlatformAdmin]);

  const { data: notifications } = useCollection<AdminReservationNotification>(notificationsQuery);
  const adminNotifications = useMemo(() => notifications ?? [], [notifications]);

  if (!isPlatformAdmin) {
    return null;
  }

  const notificationCount = adminNotifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label={`Notifiche amministratore${notificationCount > 0 ? `, ${notificationCount} elementi` : ''}`}
        >
          <Bell className="h-4.5 w-4.5" />
          {notificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Notifiche prenotazione</p>
          <p className="text-xs text-slate-500">Nuovi contratti e passaggi a "Prenotato".</p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-2">
          {adminNotifications.length > 0 ? (
            <div className="space-y-2">
              {adminNotifications.map(notification => (
                <div key={notification.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                      Prenotato
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-slate-500">
                    <p>Contratto: {notification.contractId}</p>
                    {notification.customerName ? <p>Cliente: {notification.customerName}</p> : null}
                    <p>Veicolo: {notification.vehicleLabel}</p>
                    <p>Creato: {formatNotificationTime(notification.createdAt)}</p>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800">
                      <Link href={`/auto/${notification.vehicleSlug}`}>
                        Apri annuncio
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-900">Nessuna notifica recente</p>
              <p className="mt-1 text-xs text-slate-500">Le nuove prenotazioni appariranno qui.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
