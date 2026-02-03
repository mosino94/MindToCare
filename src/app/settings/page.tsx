
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { auth, database } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match.",
  path: ['confirmPassword'],
});

export default function SettingsPage() {
  const { user, name } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleChangePassword = async (data: z.infer<typeof passwordSchema>) => {
    if (!user?.email) return;

    setLoading(true);
    const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
    
    try {
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully.',
      });
      passwordForm.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating password',
        description: error.code === 'auth/wrong-password' ? 'The current password you entered is incorrect.' : error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = ref(database, `users/${user.uid}`);
      await update(userRef, { status: 'deactivated' });
      await signOut(auth);
      toast({
        title: 'Account Deactivated',
        description: 'Your account has been deactivated. You can reactivate it by logging back in.',
      });
      router.push('/login');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = ref(database, `users/${user.uid}`);
      const deletionTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await update(userRef, { status: 'pending_deletion', deletionScheduledAt: deletionTime });
      await signOut(auth);
      toast({
        title: 'Account Deletion Scheduled',
        description: 'Your account will be permanently deleted in 3 days. Log in again to cancel.',
      });
      router.push('/login');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">Settings</h1>
        <p className="text-muted-foreground md:text-xl/relaxed">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="deactivate">Deactivate</TabsTrigger>
          <TabsTrigger value="delete">Delete</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your personal account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input id="accountName" type="text" value={name || ''} disabled />
                    <p className="text-sm text-muted-foreground">
                        This is your permanent account name and cannot be changed.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" value={user?.email || ''} disabled />
                    <p className="text-sm text-muted-foreground">
                        Your email address is used for logging in and cannot be changed.
                    </p>
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password here. Use a strong, unique password.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} disabled={loading || user?.providerData.some(p => p.providerId === 'google.com')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} disabled={loading || user?.providerData.some(p => p.providerId === 'google.com')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} disabled={loading || user?.providerData.some(p => p.providerId === 'google.com')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={loading || user?.providerData.some(p => p.providerId === 'google.com')}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                   {user?.providerData.some(p => p.providerId === 'google.com') && (
                        <p className="text-sm text-muted-foreground">
                            Password management is not available for accounts signed in with Google.
                        </p>
                   )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deactivate">
          <Card>
            <CardHeader>
              <CardTitle>Deactivate Account</CardTitle>
              <CardDescription>
                Deactivating your account will temporarily disable it. Your profile and data will be hidden, but not deleted.
                You can reactivate your account at any time by simply logging back in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loading}>Deactivate Account</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will temporarily deactivate your account. You will be logged out, and your profile will be hidden until you log back in.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeactivate} disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delete">
          <Card>
            <CardHeader>
              <CardTitle>Delete Account</CardTitle>
              <CardDescription className="text-destructive font-medium">
                This is a permanent action. Please read carefully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Deleting your account will schedule it for permanent removal. All of your data, including your profile,
                chat history, and reviews, will be erased.
              </p>
              <p>
                There is a <span className="font-bold">3-day grace period</span>. If you log in within 3 days, the deletion will be cancelled.
                After 3 days, this action is irreversible.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loading}>Schedule Account Deletion</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. Your account will be permanently deleted after 3 days.
                      All of your data will be lost forever.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, Delete My Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
