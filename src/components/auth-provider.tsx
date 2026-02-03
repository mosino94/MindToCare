'use client';

import { useState, useEffect, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthContext, type UserRole } from '@/context/auth-context';
import { auth, database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { usePathname, useRouter } from 'next/navigation';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // User Data State
  const [role, setRole] = useState<UserRole>('member');
  const [identity, setIdentity] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [hasCompletedListenerProfile, setHasCompletedListenerProfile] = useState(false);
  const [memberProfileCompleted, setMemberProfileCompleted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const userRef = ref(database, `users/${user.uid}`);
      const unsubscribeDb = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const activeRole = userData?.role || 'member';
          
          const currentRoleProfile = userData.roles?.[activeRole] || {};
          const listenerRoleProfile = userData.roles?.listener || {};
          const memberRoleProfile = userData.roles?.member || {};

          setRole(activeRole);
          setIdentity(`${user.uid}_${activeRole}`);
          setName(userData?.name || null);
          
          // Set role-specific data
          setScreenName(currentRoleProfile.screenName || null);
          setBio(currentRoleProfile.bio || null);
          setPhotoURL(currentRoleProfile.photoURL || null);
          
          // Set profile completion status
          setProfileCompleted(currentRoleProfile.profileCompleted || false);
          setHasCompletedListenerProfile(listenerRoleProfile.profileCompleted || false);
          setMemberProfileCompleted(memberRoleProfile.profileCompleted || false);

        } else {
            // This might be a freshly created user who doesn't have a DB entry yet.
            // The login/signup pages will create the entry.
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching user data from RTDB:", error);
        setLoading(false);
      });

      return () => unsubscribeDb();
    } else {
      // Reset all user-specific state when logged out
      setRole('member');
      setName(null);
      setScreenName(null);
      setIdentity(null);
      setProfileCompleted(false);
      setHasCompletedListenerProfile(false);
      setMemberProfileCompleted(false);
      setPhotoURL(null);
      setBio(null);
    }
  }, [user]);

  // Main navigation/routing effect
  useEffect(() => {
    if (loading) {
      return; 
    }

    const unauthenticatedPaths = ['/login', '/listener/training'];
    const isUnauthenticatedPath = unauthenticatedPaths.some(p => pathname.startsWith(p));
    
    // Ignore routing logic for special pages like admin
    if (pathname.startsWith('/admin')) {
      return;
    }

    // --- Handle unauthenticated users ---
    if (!user) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('roleSelectedThisSession');
      }
      if (!isUnauthenticatedPath) {
        router.push('/login');
      }
      return;
    }
    
    // --- Handle authenticated users ---
    
    // 1. Profile completion check
    if (!profileCompleted && pathname !== '/profile/complete' && !isUnauthenticatedPath) {
        router.push('/profile/complete');
        return;
    }
    
    const memberHome = '/member';
    const listenerHome = '/listener';

    // 2. Routing for users with completed profiles
    if (profileCompleted) {
        // Redirect away from completion page if profile is already complete
        if (pathname === '/profile/complete') {
            router.push(role === 'listener' ? listenerHome : memberHome);
            return;
        }

        const isAtRoot = pathname === '/';
        const isAtMemberHome = pathname.startsWith(memberHome);
        const isAtListenerHome = pathname.startsWith(listenerHome);

        // Redirect from root to role-specific home
        if (isAtRoot) {
            router.push(role === 'listener' ? listenerHome : memberHome);
            return;
        }
        
        // Prevent role mismatch access to home pages
        if (role === 'listener' && isAtMemberHome) {
            router.push(listenerHome);
        } else if (role === 'member' && isAtListenerHome && pathname !== '/listener/training') {
            router.push(memberHome);
        }
    }

  }, [user, role, profileCompleted, loading, router, pathname]);

  const value = { user, role, name, screenName, bio, profileCompleted, hasCompletedListenerProfile, memberProfileCompleted, loading, photoURL, identity };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
