'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, getFirestore } from 'firebase/firestore';
import { useMemo } from 'react';
import type { UserProfile } from '@/lib/types';


export const useAuth = () => {
  const { user, loading: userLoading, error: userError } = useUser();
  
  const userProfileRef = useMemo(() => {
    if (!user) return null;
    return doc(getFirestore(), 'users', user.uid);
  }, [user]);

  const { data: userProfile, loading: profileLoading, error: profileError } = useDoc<UserProfile>(userProfileRef);

  return {
    user,
    userProfile,
    isAdmin: userProfile?.role === 'admin',
    loading: userLoading || profileLoading,
    error: userError || profileError,
  };
};
