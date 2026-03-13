'use client';

import { useUser } from '@/firebase/provider';
import type { User as UserData, Role } from '@/lib/types';
import { useMemo } from 'react';
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
 * Hook to get the current user's role from their document in Firestore.
 */
export function useUserRole(): UserRoleState {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  // This hook will fetch the user's document and subscribe to real-time updates.
  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);

  const roleState = useMemo((): UserRoleState => {
    const isLoading = isAuthLoading || (!!user && isUserDataLoading);

    if (isLoading) {
      return { role: null, roleData: null, isLoading: true };
    }
    
    if (!user) {
        return { role: null, roleData: null, isLoading: false };
    }

    // If there's a user but no document yet (e.g., just after registration before doc is created)
    // or if the document exists but is empty.
    if (!userData) {
      const basicUserData: UserData = {
        id: user.uid,
        email: user.email!,
        role: null,
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
      };
      return { role: null, roleData: basicUserData, isLoading: false };
    }

    // User and user document are available.
    return { role: userData.role, roleData: userData, isLoading: false };
  }, [isAuthLoading, isUserDataLoading, user, userData]);

  return roleState;
}
