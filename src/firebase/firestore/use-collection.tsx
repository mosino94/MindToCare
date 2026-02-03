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

export function useCollection<T extends DocumentWithId>(q: Query<T> | null) {
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
        const permissionError = new FirestorePermissionError({
          path: `(collection query)`, 
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error('Error fetching collection:', error);
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, isLoading };
}
