'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, type User } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, set, get, push, update } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, UserPlus, HeartHandshake } from 'lucide-react';
import { Icons } from '@/components/icons';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const signInSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const signUpSchema = z.object({
  name: z.string().min(1, { message: 'Please enter your name.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type SignInFormValue = z.infer<typeof signInSchema>;
type SignUpFormValue = z.infer<typeof signUpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isExistingUserRoleDialogOpen, setIsExistingUserRoleDialogOpen] = useState(false);
  
  const [googleUser, setGoogleUser] = useState<User | null>(null);

  const signInForm = useForm<SignInFormValue>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  
  const signUpForm = useForm<SignUpFormValue>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  
  useEffect(() => {
    signInForm.reset();
    signUpForm.reset();
  }, [authMode, signInForm, signUpForm]);
  
  const createWelcomeNotification = async (userId: string, role: 'member' | 'listener') => {
    const identity = `${userId}_${role}`;
    const notificationsRef = ref(database, `notifications/${identity}`);
    const welcomeMessage = role === 'member'
      ? "Welcome to GeoPresence! This is a safe space to talk about what's on your mind. Remember to keep personal information private and take things at your own pace."
      : "Welcome to the team! Thank you for being part of our supportive community. Please always remember to maintain boundaries, respect, and privacy in all your conversations.";
    
    const newNotificationRef = push(notificationsRef);
    await set(newNotificationRef, {
      message: welcomeMessage,
      read: false,
      createdAt: Date.now(),
      type: 'welcome'
    });
  };

  const handleSignIn = async ({ email, password }: SignInFormValue) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: 'User does not exist or password was incorrect. Please try again or sign up.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async ({ name, email, password }: SignUpFormValue) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = ref(database, 'users/' + user.uid);
      await set(userRef, {
        name: name,
        email: user.email,
        createdAt: Date.now(),
        role: 'member', // Default active role
        roles: {
            member: { profileCompleted: false },
            listener: { profileCompleted: false }
        },
        sharedProfile: {},
      });
      
      await createWelcomeNotification(user.uid, 'member');

      toast({
          title: 'Account Created',
          description: "You have been successfully signed up! Let's complete your profile.",
        });
      router.push('/profile/complete');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'Could not create account. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            const userData = snapshot.val();
            const hasCompletedMemberProfile = userData.roles?.member?.profileCompleted;
            const hasCompletedListenerProfile = userData.roles?.listener?.profileCompleted;

            if (hasCompletedMemberProfile || hasCompletedListenerProfile) {
                // This is a returning user with at least one completed profile.
                if (hasCompletedMemberProfile && hasCompletedListenerProfile) {
                     // If they have both, ask which role to use for this session.
                     setGoogleUser(user);
                     setIsExistingUserRoleDialogOpen(true);
                } else {
                    // If they have only one, log them in directly.
                    router.push('/');
                }
            } else {
                // User exists in DB but has not completed any profile. Treat as a new user.
                setGoogleUser(user);
                setIsRoleDialogOpen(true);
            }
        } else {
            // This is a brand new user.
            setGoogleUser(user);
            setIsRoleDialogOpen(true);
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Google Sign-In Failed',
            description: error.message || 'Could not sign in with Google. Please try again.',
        });
    } finally {
        setLoading(false);
    }
  };

  const handleSelectExistingUserRole = async (role: 'member' | 'listener') => {
    if (!googleUser) return;
    setLoading(true);
    setIsExistingUserRoleDialogOpen(false);
    try {
        const userRef = ref(database, `users/${googleUser.uid}`);
        await update(userRef, { role });
        sessionStorage.setItem('roleSelectedThisSession', 'true');
        router.push('/');
    } catch (error: any) {
        console.error("Failed to update role for existing user", error);
        toast({
            variant: 'destructive',
            title: 'Role Selection Failed',
            description: 'Could not switch your role. Please try again.',
        });
    } finally {
        setLoading(false);
        setGoogleUser(null);
    }
  };
  
  const createGoogleUserAndRedirect = async (role: 'member' | 'listener') => {
    if (!googleUser) return;
    
    setLoading(true);
    setIsRoleDialogOpen(false);
    const userRef = ref(database, `users/${googleUser.uid}`);
    
    try {
        await set(userRef, {
            name: googleUser.displayName,
            email: googleUser.email,
            createdAt: Date.now(),
            role: role,
            roles: {
                member: { profileCompleted: false, photoURL: googleUser.photoURL },
                listener: { profileCompleted: false, photoURL: googleUser.photoURL }
            },
            sharedProfile: {},
        });

        await createWelcomeNotification(googleUser.uid, role);

        toast({
            title: 'Welcome!',
            description: role === 'listener' 
                ? 'Next, please complete the listener training.'
                : 'Please complete your profile to get started.',
        });
        
        if (role === 'listener') {
            router.push('/listener/training');
        } else {
            router.push('/profile/complete');
        }
    
    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Account Creation Failed',
            description: error.message || 'Could not create your account. Please try again.',
        });
    } finally {
        setLoading(false);
        setGoogleUser(null);
    }
  };
  
  const handleBecomeMember = () => {
    if (googleUser) {
        createGoogleUserAndRedirect('member');
    } else {
        setIsRoleDialogOpen(false);
        setAuthMode('signup');
    }
  };

  const handleBecomeListener = () => {
    if (googleUser) {
        createGoogleUserAndRedirect('listener');
    } else {
        setIsRoleDialogOpen(false);
        router.push('/listener/training');
    }
  };

  const onRoleDialogClose = (open: boolean) => {
    if (!open) {
        setGoogleUser(null);
    }
    setIsRoleDialogOpen(open);
  };


  const renderSignInForm = () => (
    <Form {...signInForm}>
      <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
        <FormField
          control={signInForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" disabled={loading} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signInForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" disabled={loading} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In <LogIn className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form>
  );

  const renderSignUpForm = () => (
    <Form {...signUpForm}>
      <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
        <FormField
          control={signUpForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" disabled={loading} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" disabled={loading} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" disabled={loading} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account <UserPlus className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <Card className="w-full max-w-sm animate-in fade-in-0 zoom-in-95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Icons.logo className="h-12 w-auto" />
          </div>
          <CardTitle className="text-2xl font-headline">
            {authMode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'signin' ? 'A safe space for connection and support' : 'Join our community to find support'}
          </CardDescription>
        </CardHeader>
        <CardContent>
            {authMode === 'signup' ? (
              renderSignUpForm()
            ) : (
              <>
                <Button variant="outline" className="w-full mb-4" onClick={handleGoogleSignIn} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Icons.google className="mr-2 h-4 w-4" />
                  Sign in with Google
                </Button>
                <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                        </span>
                    </div>
                </div>
                {renderSignInForm()}
              </>
            )}
          <div className="mt-4 text-center text-sm">
            {authMode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setIsRoleDialogOpen(true)}>
                  Sign Up
                </Button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setAuthMode('signin')}>
                  Sign In
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
       <Dialog open={isRoleDialogOpen} onOpenChange={onRoleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Your Path</DialogTitle>
            <DialogDescription>
              How would you like to join our community?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
              <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleBecomeMember}>
                <UserPlus className="h-6 w-6"/>
                <span>Become a Member</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleBecomeListener}>
                 <HeartHandshake className="h-6 w-6"/>
                 <span>Become a Listener</span>
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isExistingUserRoleDialogOpen} onOpenChange={(open) => {
        if (!open) setGoogleUser(null);
        setIsExistingUserRoleDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Your Role</DialogTitle>
            <DialogDescription>
              You have profiles for both roles. Which one would you like to use for this session?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
              <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => handleSelectExistingUserRole('member')} disabled={loading}>
                {loading && <Loader2 className="h-6 w-6 animate-spin"/>}
                {!loading && <UserPlus className="h-6 w-6"/>}
                <span>Member</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => handleSelectExistingUserRole('listener')} disabled={loading}>
                 {loading && <Loader2 className="h-6 w-6 animate-spin"/>}
                 {!loading && <HeartHandshake className="h-6 w-6"/>}
                 <span>Listener</span>
              </Button>
          </div>
        </DialogContent>
    </Dialog>
    </div>
  );
}
