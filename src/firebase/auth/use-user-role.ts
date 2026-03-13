'use client';

import type { User as UserData, Role } from '@/lib/types';
import { useUser } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';

export type { Role };

export interface UserRoleState {
  role: Role;
  roleData: UserData | null;
  isLoading: boolean;
}

/**
 * Hook to get the current user's role and profile data from Firestore.
 * It listens to auth state and fetches the corresponding document from the 'users' collection.
 */
export function useUserRole(): UserRoleState {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userData, isLoading: isDocLoading } = useDoc<UserData>(userDocRef);

  const isLoading = isAuthLoading || (!!user && isDocLoading);

  if (isLoading) {
    return { role: null, roleData: null, isLoading: true };
  }

  if (!user || !userData) {
    // If the user is anonymous, we can treat them as an admin for development.
    if (user?.isAnonymous) {
      return {
        role: 'admin',
        roleData: {
            id: user.uid,
            email: 'anonymous@dev.com',
            createdAt: new Date(),
            role: 'admin',
        },
        isLoading: false
      }
    }
    return { role: null, roleData: null, isLoading: false };
  }

  return {
    role: userData.role || null,
    roleData: userData,
    isLoading: false,
  };
}
