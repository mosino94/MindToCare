'use client';
import { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseErrorListener } from './error-listener';

interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children, value }: { children: ReactNode, value: FirebaseContextValue }) {
  return (
      <FirebaseContext.Provider value={value}>
          {children}
          <FirebaseErrorListener />
      </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useFirebaseApp() {
    return useFirebase().app;
}

export function useFirestore() {
    return useFirebase().firestore;
}

export function useFirebaseAuth() {
    return useFirebase().auth;
}
