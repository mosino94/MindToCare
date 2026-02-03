
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

const ADMIN_PASSWORD = 'MohsinHigh-5';
const ADMIN_EMAIL = 'mdmohsinhossain94@gmail.com';

const loginSchema = z.object({
  password: z.string().min(1, { message: 'Password is required.' }),
});

const forgotPasswordSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid email.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isForgotDialogOpen, setIsForgotDialogOpen] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
  });
  
  const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });


  const handleLogin = (data: LoginFormValues) => {
    if (data.password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuthenticated', 'true');
      onLoginSuccess();
    } else {
      form.setError('password', {
        type: 'manual',
        message: 'Incorrect password.',
      });
    }
  };
  
  const handlePasswordReset = async (data: ForgotPasswordFormValues) => {
    setResetLoading(true);
    if (data.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        toast({
            variant: 'destructive',
            title: 'Incorrect Email',
            description: 'The email address provided is not correct.',
        });
        setResetLoading(false);
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, ADMIN_EMAIL);
        toast({
            title: 'Password Reset Email Sent',
            description: `An email has been sent to ${ADMIN_EMAIL} with instructions to reset your password.`,
        });
        setIsForgotDialogOpen(false);
    } catch(error: any) {
        toast({
            variant: 'destructive',
            title: 'Error Sending Email',
            description: error.message || 'Could not send password reset email. Please try again.',
        });
    } finally {
        setResetLoading(false);
    }
  }

  return (
      <Card className="w-full max-w-sm animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>
            This area is restricted. Please enter the password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unlock
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-sm text-center flex-col items-center">
            <Dialog open={isForgotDialogOpen} onOpenChange={setIsForgotDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="link" className="p-0 h-auto">Forgot Password?</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Admin Password</DialogTitle>
                        <DialogDescription>
                            Enter the admin email address to receive a password reset link.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...forgotPasswordForm}>
                        <form onSubmit={forgotPasswordForm.handleSubmit(handlePasswordReset)} className="space-y-4 py-4">
                             <FormField
                                control={forgotPasswordForm.control}
                                name="email"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Admin Email</FormLabel>
                                    <FormControl>
                                    <Input type="email" placeholder="admin@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={resetLoading}>
                                     {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Reset Link
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </CardFooter>
      </Card>
  );
}
