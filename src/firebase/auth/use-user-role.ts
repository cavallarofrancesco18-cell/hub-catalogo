'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import type { SellerRole as SellerRoleData } from '@/lib/types';

export type Role = 'admin' | 'seller' | null;

export interface UserRoleState {
  role: Role;
  roleData: SellerRoleData | { assignedAt: any } | null;
  isLoading: boolean;
}

export function useUserRole(): UserRoleState {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [roleState, setRoleState] = useState<UserRoleState>({
    role: null,
    roleData: null,
    isLoading: true,
  });

  useEffect(() => {
    // If auth is still loading or Firestore isn't ready, just wait.
    if (isUserLoading || !firestore) {
      return;
    }
    
    // If there is no user, reset the state to a clean logged-out state.
    if (!user) {
      setRoleState({ role: null, roleData: null, isLoading: false });
      return;
    }

    const checkRoles = async () => {
      // We have a user, so we will check their role. isLoading remains true
      // from the initial state until we determine the role.
      try {
        // Check for admin role first.
        const adminRef = doc(firestore, 'roles_admin', user.uid);
        const adminDoc = await getDoc(adminRef);
        if (adminDoc.exists()) {
          setRoleState({ role: 'admin', roleData: adminDoc.data(), isLoading: false });
          return; // Role found, no need to check further.
        }

        // If not admin, check for seller role.
        const sellerRef = doc(firestore, 'roles_seller', user.uid);
        const sellerDoc = await getDoc(sellerRef);
        if (sellerDoc.exists()) {
          setRoleState({ role: 'seller', roleData: sellerDoc.data() as SellerRoleData, isLoading: false });
          return; // Role found.
        }

        // If neither admin nor seller, the user has no specific role.
        setRoleState({ role: null, roleData: null, isLoading: false });

      } catch (error) {
        console.error("Error checking user roles:", error);
        // In case of an error, reset to a clean, non-privileged state.
        setRoleState({ role: null, roleData: null, isLoading: false });
      }
    };

    checkRoles();
  }, [user, isUserLoading, firestore]);

  return roleState;
}
