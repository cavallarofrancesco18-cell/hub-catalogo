'use client';

import { useUser } from '@/firebase/provider';
import type { User as UserData } from '@/lib/types';
import { useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';

export type Role = 'admin' | 'seller' | null;

export interface UserRoleState {
  role: Role;
  roleData: UserData | null;
  isLoading: boolean;
}

/**
 * Hook to get the current user's role from their document in Firestore.
 * It checks for a document in the 'users' (for admins) or 'sellers' collection.
 */
export function useUserRole(): UserRoleState {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const adminDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const sellerDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'sellers', user.uid);
  }, [user, firestore]);

  const { data: adminData, isLoading: isAdminDataLoading } = useDoc<UserData>(adminDocRef);
  const { data: sellerData, isLoading: isSellerDataLoading } = useDoc<UserData>(sellerDocRef);

  const roleState = useMemo((): UserRoleState => {
    const isLoading = isAuthLoading || (!!user && (isAdminDataLoading || isSellerDataLoading));

    if (isLoading) {
      return { role: null, roleData: null, isLoading: true };
    }
    
    if (!user) {
        return { role: null, roleData: null, isLoading: false };
    }

    if (adminData) {
      return { role: 'admin', roleData: adminData, isLoading: false };
    }

    if (sellerData) {
      return { role: 'seller', roleData: sellerData, isLoading: false };
    }

    // User is authenticated but has no role document in either collection.
    const basicUserData: UserData = {
        id: user.uid,
        email: user.email!,
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
    };
    return { role: null, roleData: basicUserData, isLoading: false };

  }, [isAuthLoading, isAdminDataLoading, isSellerDataLoading, user, adminData, sellerData]);

  return roleState;
}
