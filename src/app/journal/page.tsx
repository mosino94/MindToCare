'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, Loader2, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { NewJournalDialog } from '@/components/new-journal-dialog';
import { Input } from '@/components/ui/input';

const moodEmojis: { [key: string]: string } = {
  Happy: '😄',
  Sad: '😢',
  Neutral: '😐',
  Excited: '🎉',
  Calm: '😌',
  Anxious: '😟',
  Grateful: '🙏',
};

// Function to strip HTML and truncate text
const createSnippet = (html: string, length = 150) => {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, '');
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

export default function JournalListPage() {
  const { user, loading: authLoading } = useAuth();
  const db = useFirestore();
  const [isNewJournalOpen, setIsNewJournalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const q = useMemoFirebase(() => {
    if (user && db) {
      return query(
        collection(db, 'users', (user as any).uid, 'journals'),
        orderBy('createdAt', 'desc')
      ) as any;
    }
    return null;
  }, [user, db]);

  const { data: journals, isLoading: collectionLoading } = useCollection(q);

  const filteredJournals = useMemo(() => {
    if (!journals) return [];
    if (!searchTerm.trim()) return journals;

    const term = searchTerm.toLowerCase();
    return journals.filter(journal =>
      journal.title?.toLowerCase().includes(term) ||
      journal.content?.toLowerCase().includes(term)
    );
  }, [journals, searchTerm]);

  const isLoading = authLoading || (user && collectionLoading);

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // AuthProvider handles redirect
  }

  if (!journals || journals.length === 0) {
    return (
      <div className="container mx-auto max-w-5xl p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">My Journal</h1>
            <p className="text-muted-foreground md:text-xl/relaxed">
              A private space for your thoughts and reflections.
            </p>
          </div>
          <Button onClick={() => setIsNewJournalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Entry
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-card mt-8">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Entries Here</h3>
          <p className="text-muted-foreground max-w-md">
            Create your first journal entry by clicking the "New Entry" button.
          </p>
        </div>
        <NewJournalDialog open={isNewJournalOpen} onOpenChange={setIsNewJournalOpen} />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto max-w-5xl p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">My Journal</h1>
            <p className="text-muted-foreground md:text-xl/relaxed">
              A private space for your thoughts and reflections.
            </p>
          </div>
          <Button onClick={() => setIsNewJournalOpen(true)} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            New Entry
          </Button>
        </div>

        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search journals by title or content..."
            className="pl-10 pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filteredJournals.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-card mt-4">
            <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground max-w-md">
              We couldn't find any journals matching "<strong>{searchTerm}</strong>".
            </p>
            <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2 text-primary">
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredJournals.map((journal) => (
              <Card key={journal.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{journal.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 pt-1">
                    {journal.mood && (
                      <span title={journal.mood}>{moodEmojis[journal.mood]}</span>
                    )}
                    <span>
                      {journal.createdAt && typeof journal.createdAt.toDate === 'function'
                        ? format(journal.createdAt.toDate(), 'MMMM d, yyyy')
                        : journal.createdAt instanceof Date
                          ? format(journal.createdAt, 'MMMM d, yyyy')
                          : 'Recently'}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="line-clamp-4 text-sm text-muted-foreground">
                    {createSnippet(journal.content)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <NewJournalDialog open={isNewJournalOpen} onOpenChange={setIsNewJournalOpen} />
    </>
  );
}
