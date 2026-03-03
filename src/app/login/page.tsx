'use client';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';
import { useEffect } from 'react';

async function createUserProfile(user: User) {
  const db = getFirestore();
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    // Create user profile on first login, default role is 'seller'
    await setDoc(userRef, {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      role: 'seller', // Default role
    });
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading && user) {
      router.push('/auto');
    }
  }, [user, loading, router]);


  const handleSignIn = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await createUserProfile(result.user);
      router.push('/auto');
    } catch (error) {
      console.error('Error during sign-in:', error);
    }
  };

  if(loading || user) {
    return <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">Loading...</div>
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Login</CardTitle>
          <CardDescription>Accedi per continuare su LuxDrive Catalog</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleSignIn}>
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.2 64.5C308.6 102.3 282.7 90 248 90c-82.1 0-148.9 66.8-148.9 148.9s66.8 148.9 148.9 148.9c93.5 0 130.8-71.5 136-112.4H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"></path></svg>
            Accedi con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
