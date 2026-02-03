'use client';

import { createContext } from 'react';
import type { User } from 'firebase/auth';

export type UserRole = 'member' | 'listener' | 'admin';

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  // From shared profile
  name: string | null; // This is the full name
  // From role-specific profile
  screenName: string | null;
  bio: string | null;
  photoURL: string | null;
  // Status
  profileCompleted: boolean; // For the current role
  hasCompletedListenerProfile: boolean;
  memberProfileCompleted: boolean;
  identity: string | null; // This should stay as uid_role
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'member',
  loading: true,
  name: null,
  screenName: null,
  bio: null,
  photoURL: null,
  profileCompleted: false,
  hasCompletedListenerProfile: false,
  memberProfileCompleted: false,
  identity: null,
});
