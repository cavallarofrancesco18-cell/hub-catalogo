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

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

/**
 * Hook to get the current user's role.
 * Admin role is determined by a hardcoded UID.
 * Seller role is determined by document existence in the 'seller' collection.
 */
export function useUserRole(): UserRoleState {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const sellerDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'seller', user.uid);
  }, [user, firestore]);

  const { data: sellerData, isLoading: isSellerDataLoading } = useDoc<UserData>(sellerDocRef);

  const roleState = useMemo((): UserRoleState => {
    const isLoading = isAuthLoading || (!!user && isSellerDataLoading);

    if (isLoading) {
      return { role: null, roleData: null, isLoading: true };
    }
    
    if (!user) {
        return { role: null, roleData: null, isLoading: false };
    }

    // Check for admin role by UID first
    if (user.uid === ADMIN_UID) {
      // Create a UserData object for the admin on the fly
      const adminUserData: UserData = {
          id: user.uid,
          email: user.email!,
          createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
          sellerType: 'HUB',
      };
      return { role: 'admin', roleData: adminUserData, isLoading: false };
    }

    if (sellerData) {
      return { role: 'seller', roleData: sellerData, isLoading: false };
    }

    // User is authenticated but has no specific role document.
    const basicUserData: UserData = {
        id: user.uid,
        email: user.email!,
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
    };
    return { role: null, roleData: basicUserData, isLoading: false };

  }, [isAuthLoading, isSellerDataLoading, user, sellerData]);

  return roleState;
}
