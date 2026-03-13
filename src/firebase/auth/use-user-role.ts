'use client';

import { useUser } from '@/firebase/provider';
import type { User as UserData, Role } from '@/lib/types';
import { useMemo } from 'react';

export type { Role };

export interface UserRoleState {
  role: Role;
  roleData: UserData | null;
  isLoading: boolean;
}

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

/**
 * Hook to get the current user's role.
 * This implementation is specific to the admin user identified by a hardcoded UID.
 */
export function useUserRole(): UserRoleState {
  const { user, isUserLoading: isAuthLoading } = useUser();

  const roleState = useMemo((): UserRoleState => {
    if (isAuthLoading) {
      return { role: null, roleData: null, isLoading: true };
    }

    if (user && user.uid === ADMIN_UID) {
      const adminData: UserData = {
        id: user.uid,
        email: user.email || 'admin@example.com',
        role: 'admin',
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
      };
      return { role: 'admin', roleData: adminData, isLoading: false };
    }

    // For any other user, they have no specific role.
    const otherUserData: UserData | null = user ? {
        id: user.uid,
        email: user.email!,
        role: null,
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
    } : null;

    return { role: null, roleData: otherUserData, isLoading: false };
  }, [isAuthLoading, user]);

  return roleState;
}
