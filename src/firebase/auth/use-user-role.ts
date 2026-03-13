'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import type { User as UserData, Role } from '@/lib/types';

export type { Role };

export interface UserRoleState {
  role: Role;
  roleData: UserData | null;
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
      setRoleState({ role: null, roleData: null, isLoading: true });
      return;
    }
    
    // If there is no user, reset the state to a clean logged-out state.
    if (!user) {
      setRoleState({ role: null, roleData: null, isLoading: false });
      return;
    }

    const userRef = doc(firestore, 'users', user.uid);
    // Subscribe to the user document to get real-time role updates
    const unsubscribe = onSnapshot(userRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = {id: docSnap.id, ...docSnap.data()} as UserData;
          setRoleState({ role: userData.role, roleData: userData, isLoading: false });
        } else {
          // This case handles users who are authenticated with Firebase Auth
          // but do not have a corresponding document in the 'users' collection.
          setRoleState({ role: null, roleData: null, isLoading: false });
        }
      },
      (error) => {
        console.error("Error subscribing to user role:", error);
        // In case of an error (like permissions), reset to a non-privileged state.
        setRoleState({ role: null, roleData: null, isLoading: false });
      }
    );

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [user, isUserLoading, firestore]);

  return roleState;
}
