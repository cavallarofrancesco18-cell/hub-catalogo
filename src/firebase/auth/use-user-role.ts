'use client';

import type { User as UserData, Role } from '@/lib/types';

export type { Role };

export interface UserRoleState {
  role: Role;
  roleData: UserData | null;
  isLoading: boolean;
}

/**
 * This hook has been modified to return a hardcoded 'admin' role,
 * effectively disabling real role checks for rebuilding purposes.
 */
export function useUserRole(): UserRoleState {
  return {
    role: 'admin',
    roleData: {
      id: 'fake-admin-uid',
      email: 'admin@example.com',
      createdAt: new Date(),
      role: 'admin',
      sellerType: undefined,
    },
    isLoading: false,
  };
}
