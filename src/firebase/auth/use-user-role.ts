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
    // If auth is still loading or Firestore isn't ready, reflect the loading state.
    if (isUserLoading || !firestore) {
      setRoleState((prev) => ({ ...prev, isLoading: true }));
      return;
    }
    
    // If there is no user, reset the state to logged-out.
    if (!user) {
      setRoleState({ role: null, roleData: null, isLoading: false });
      return;
    }

    const checkRoles = async () => {
      // Set loading to true, but don't clear existing role data yet.
      // This prevents the UI from flickering back to a default state during role checks.
      setRoleState((prev) => ({ ...prev, isLoading: true }));

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
    // This effect should re-run whenever the user's authentication state changes.
  }, [user, isUserLoading, firestore]);

  return roleState;
}
