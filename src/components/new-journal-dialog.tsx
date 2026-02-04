

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase/index';
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Smile, Clock } from 'lucide-react';
import { RichTextEditor } from '@/components/rich-text-editor';
import { format } from 'date-fns';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import '../app/tiptap.css';

const journalFormSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  createdAt: z.date().default(() => new Date()),
  content: z.string().min(1, 'Content cannot be empty.'),
  mood: z.string().optional(),
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

// Type for journal data when editing
export interface JournalData {
  id: string;
  title: string;
  content: string;
  mood?: string;
  createdAt: Date;
}

interface NewJournalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: JournalData | null; // Optional data for edit mode
  onSaved?: () => void; // Callback when saved successfully
}


export function NewJournalDialog({ open, onOpenChange, editData, onSaved }: NewJournalDialogProps) {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const isEditMode = !!editData;

  const onToggleFullscreen = useCallback(() => setIsFullscreen(prev => !prev), []);

  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      title: '',
      createdAt: new Date(),
      content: '',
      mood: '',
    },
  });

  // Update form when editData changes
  useEffect(() => {
    if (editData && open) {
      form.reset({
        title: editData.title,
        content: editData.content,
        mood: editData.mood || '',
        createdAt: editData.createdAt,
      });
      setEditorKey(prev => prev + 1);
    }
  }, [editData, open, form]);

  const onSubmit = async (data: JournalFormValues) => {
    const isEmpty = !data.content || data.content.replace(/<[^>]*>/g, '').trim() === '';
    if (isEmpty) {
      form.setError('content', { message: 'Content cannot be empty.' });
      return;
    }
    if (!user || !db) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in and the database available to save an entry.' });
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && editData) {
        // Update existing journal
        const docRef = doc(db, 'users', user.uid, 'journals', editData.id);
        await updateDoc(docRef, {
          title: data.title,
          content: data.content,
          mood: data.mood || null,
          createdAt: data.createdAt,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: 'Journal Updated!',
          description: 'Your entry has been updated successfully.',
        });
      } else {
        // Create new journal
        const collectionRef = collection(db, 'users', user.uid, 'journals');
        await addDoc(collectionRef, {
          ...data,
          userId: user.uid,
          createdAt: data.createdAt,
          updatedAt: serverTimestamp(),
          status: 'active',
        });
        toast({
          title: 'Journal Entry Saved!',
          description: 'Your thoughts are safe with us.',
        });
      }
      form.reset();
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      console.error('Error saving journal:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'There was a problem saving your entry. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setIsFullscreen(false);
      form.reset({
        title: '',
        createdAt: new Date(),
        content: '',
        mood: '',
      });
      setEditorKey(prev => prev + 1);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-2xl flex flex-col p-0",
        isFullscreen ? "h-full w-full max-w-full rounded-none border-none" : "h-[90vh]"
      )}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            {isFullscreen ? (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="flex-1 flex flex-col min-h-0">
                    <RichTextEditor
                      key={editorKey}
                      value={field.value}
                      onChange={field.onChange}
                      isFullscreen={isFullscreen}
                      onToggleFullscreen={onToggleFullscreen}
                      className="flex-1"
                      placeholder="Start writing your journal entry here..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <DialogHeader className="p-6 pb-0 text-center shrink-0">
                  <DialogTitle>{isEditMode ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? 'Update your thoughts and feelings.' : 'Capture your thoughts, feelings, and moments.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto hide-scrollbar">
                  <div className="space-y-6 p-6">
                    <div>
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="What's on your mind?" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="mood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2"><Smile className="h-4 w-4" /> Mood</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="How are you feeling?" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Happy">😄 Happy</SelectItem>
                                <SelectItem value="Sad">😢 Sad</SelectItem>
                                <SelectItem value="Neutral">😐 Neutral</SelectItem>
                                <SelectItem value="Excited">🎉 Excited</SelectItem>
                                <SelectItem value="Calm">😌 Calm</SelectItem>
                                <SelectItem value="Anxious">😟 Anxious</SelectItem>
                                <SelectItem value="Grateful">🙏 Grateful</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="createdAt"
                        render={({ field }) => (
                          <div className="grid grid-cols-2 gap-4 items-end">
                            <FormItem>
                              <Label className="flex items-center gap-2 mb-2">
                                <CalendarIcon className="h-4 w-4" />
                                <span>Date</span>
                              </Label>
                              <Input
                                type="date"
                                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                onChange={(e) => {
                                  const dateString = e.target.value;
                                  if (!dateString) return;
                                  const [year, month, day] = dateString.split('-').map(Number);
                                  const current = field.value || new Date();
                                  const newDate = new Date(year, month - 1, day, current.getHours(), current.getMinutes());
                                  field.onChange(newDate);
                                }}
                              />
                              <FormMessage className="mt-2" />
                            </FormItem>
                            <FormItem>
                              <Label className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4" />
                                <span>Time</span>
                              </Label>
                              <Input
                                type="time"
                                className="hide-time-icon"
                                value={field.value ? format(field.value, 'HH:mm') : ''}
                                onChange={(e) => {
                                  const time = e.target.value;
                                  if (!time) return;
                                  const [hours, minutes] = time.split(':');
                                  const current = field.value || new Date();
                                  current.setHours(parseInt(hours, 10));
                                  current.setMinutes(parseInt(minutes, 10));
                                  field.onChange(new Date(current));
                                }}
                              />
                              <FormMessage className="mt-2" />
                            </FormItem>
                          </div>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RichTextEditor
                                key={editorKey}
                                value={field.value}
                                onChange={field.onChange}
                                isFullscreen={isFullscreen}
                                onToggleFullscreen={onToggleFullscreen}
                                placeholder="Start writing your journal entry here..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="p-4 border-t pt-4 shrink-0">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" size="sm">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={loading} size="sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditMode ? 'Update Entry' : 'Save Entry'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
