'use client';

import type { User as UserData, Role } from '@/lib/types';

export type { Role };

export interface UserRoleState {
  role: Role;
  roleData: UserData | null;
  isLoading: boolean;
}

/**
 * MOCKED: This hook is currently mocked to always return an 'admin' role.
 * This is a temporary measure to allow development on protected routes
 * without a functional authentication flow.
 *
 * TODO: Re-implement this hook to use real authentication data when
 * the login/registration flow is rebuilt.
 */
export function useUserRole(): UserRoleState {
  const mockAdminData: UserData = {
    id: 'mock-admin-id',
    email: 'admin@example.com',
    role: 'admin',
    sellerType: 'HUB_SELLER',
    createdAt: new Date(),
  };

  return {
    role: 'admin',
    roleData: mockAdminData,
    isLoading: false,
  };
}
