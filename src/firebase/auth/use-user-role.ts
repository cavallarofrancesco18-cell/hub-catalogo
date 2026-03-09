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
    if (isUserLoading || !firestore) {
      setRoleState(prev => ({ ...prev, isLoading: true }));
      return;
    }
    if (!user) {
      setRoleState({ role: null, roleData: null, isLoading: false });
      return;
    }

    const checkRoles = async () => {
      setRoleState({ role: null, roleData: null, isLoading: true });

      try {
        const adminRef = doc(firestore, 'roles_admin', user.uid);
        const adminDoc = await getDoc(adminRef);
        if (adminDoc.exists()) {
          setRoleState({ role: 'admin', roleData: adminDoc.data(), isLoading: false });
          return;
        }

        const sellerRef = doc(firestore, 'roles_seller', user.uid);
        const sellerDoc = await getDoc(sellerRef);
        if (sellerDoc.exists()) {
          setRoleState({ role: 'seller', roleData: sellerDoc.data() as SellerRoleData, isLoading: false });
          return;
        }

        setRoleState({ role: null, roleData: null, isLoading: false });
      } catch (error) {
        console.error("Error checking user roles:", error);
        setRoleState({ role: null, roleData: null, isLoading: false });
      }
    };

    checkRoles();
  }, [user, isUserLoading, firestore]);

  return roleState;
}
