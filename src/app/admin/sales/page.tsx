'use client';

import { useUserRole } from '@/firebase';
import SalesPageContent from './sales-content';

export default function SalesPage() {
  const { role } = useUserRole();

  // Check if user is admin
  if (role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-2xl font-bold text-red-900">Accesso Negato</h1>
          <p className="mt-2 text-red-700">Solo gli admin possono accedere a questa sezione.</p>
        </div>
      </div>
    );
  }

  return <SalesPageContent />;
}
