'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

const observer: any = {
  serverTimestamps: 'estimate',
};

interface DocumentWithId extends DocumentData {
  id: string;
}

export function useCollection<T extends DocumentData>(q: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      q,
      observer,
      (querySnapshot) => {
        const data: T[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ ...doc.data(), id: doc.id } as T);
        });
        setData(data);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        setIsLoading(false);
        console.error('🔥 [useCollection] Firestore Error:', error.code, error.message);

        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: (q as any)?._query?.path?.segments?.join('/') || '(collection query)',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          // For other errors (like failed-precondition for missing indexes), 
          // let the error bubble up naturally or log it clearly.
          console.error('❌ Non-permission error encountered:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, isLoading };
}
