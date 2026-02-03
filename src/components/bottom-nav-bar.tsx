
'use client';

import { Home, MessageCircle, User, HeartHandshake, Bell, LogOut, Settings, Shield, Repeat, AlertTriangle, Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { MemberPageContext } from '@/context/member-page-context';
import { ListenerRequestNotifier } from './listener-request-notifier';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { signOut } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue, off, update, push, serverTimestamp, set } from 'firebase/database';
import { Separator } from './ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useCall } from '@/hooks/use-call';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getInitials, getStatusColor } from '@/lib/chatUtils';
import Link from 'next/link';

type ManualStatus = 'available' | 'busy' | 'offline';
type RealtimeStatus = 'online' | 'busy' | 'offline';

const reportCategories = ["Bug / Glitch", "User Harassment", "Billing Issue", "Feature Request", "General Feedback", "Other"];

function ReportIssueDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [reportText, setReportText] = useState('');
    const [category, setCategory] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmitReport = async () => {
        if (!user || reportText.trim() === '' || category === '') return;
        setIsSubmitting(true);
        try {
            const reportsRef = ref(database, 'reports');
            await push(reportsRef, {
                userId: user.uid,
                email: user.email,
                report: reportText,
                category: category,
                createdAt: serverTimestamp(),
                status: 'new',
            });
            toast({
                title: 'Report Submitted',
                description: "Thank you for your feedback. We'll look into it shortly.",
            });
            setReportText('');
            setCategory('');
            onOpenChange(false);
        } catch (error) {
            console.error("Error submitting report:", error);
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: 'Could not submit your report. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Report an Issue</DialogTitle>
                    <DialogDescription>
                        Experiencing a bug or have feedback? Let us know. Your report will be sent directly to the app owner.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="category">Issue Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="category">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {reportCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="report-text">Describe the issue</Label>
                        <Textarea
                            id="report-text"
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            placeholder="Please provide as much detail as possible..."
                            rows={5}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmitReport} disabled={isSubmitting || category === '' || reportText.trim().length < 10}>
                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, screenName, photoURL, hasCompletedListenerProfile, memberProfileCompleted, identity } = useAuth();
  const { pendingRequest } = useCall();
  const memberContext = useContext(MemberPageContext);

  const setIsRequestDialogOpen = memberContext?.setIsRequestDialogOpen ?? (() => {});

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [chatId: string]: number }>({});
  
  const [manualStatus, setManualStatus] = useState<ManualStatus>('offline');
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('offline');

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  
  const activeChatUnreadListenersRef = useRef(new Map<string, () => void>());

  const unreadChatCount = useMemo(() => {
    return Object.values(unreadCounts).filter(count => count > 0).length;
  }, [unreadCounts]);

  const handleMarkNotificationsAsRead = async () => {
    if (!user || !identity || notifications.length === 0) return;
    const updates: { [key: string]: any } = {};
    notifications.forEach(n => {
        updates[`notifications/${identity}/${n.id}/read`] = true;
    });
    await update(ref(database), updates);
  };

  // Effect to get the manually set status for the listener (for the radio buttons)
  useEffect(() => {
    if (user && role === 'listener') {
      const manualStatusRef = ref(database, `users/${user.uid}/status`);
      const unsubscribe = onValue(manualStatusRef, (snapshot) => {
        setManualStatus(snapshot.val() || 'offline');
      });
      return () => unsubscribe();
    }
  }, [user, role]);

  // Effect to get the actual, real-time status for the dot indicator
  useEffect(() => {
    if (user && identity) {
      const realTimeStatusRef = ref(database, `status/${identity}`);
      const unsubscribe = onValue(realTimeStatusRef, (snapshot) => {
        setRealtimeStatus(snapshot.val()?.state || 'offline');
      });
      return () => unsubscribe();
    }
  }, [user, identity]);

  useEffect(() => {
    if (!user || !identity) {
        // Cleanup when user logs out or identity is not available
        activeChatUnreadListenersRef.current.forEach(cleanup => cleanup());
        activeChatUnreadListenersRef.current.clear();
        setUnreadCounts({});
        setNotifications([]);
        return;
    }
    
    // Main listener for the list of chats belonging to the current user identity
    const userChatsRef = ref(database, `user_chats/${identity}`);
    const userChatsListener = onValue(userChatsRef, (snapshot) => {
        const newChatIds = new Set<string>(snapshot.exists() ? Object.keys(snapshot.val()) : []);
        const currentListeners = activeChatUnreadListenersRef.current;

        // Clean up listeners for chats that have been removed
        currentListeners.forEach((cleanup, existingChatId) => {
            if (!newChatIds.has(existingChatId)) {
                cleanup();
                currentListeners.delete(existingChatId);
            }
        });
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            let changed = false;
            Object.keys(newCounts).forEach(chatId => {
                if (!newChatIds.has(chatId)) {
                    delete newCounts[chatId];
                    changed = true;
                }
            });
            return changed ? newCounts : prev;
        });

        // Add listeners for new chats
        newChatIds.forEach(chatId => {
            if (currentListeners.has(chatId)) return;

            const unreadRef = ref(database, `chats/${chatId}/unread/${identity}`);
            const unreadListener = onValue(unreadRef, (unreadSnapshot) => {
                setUnreadCounts(prev => ({
                    ...prev,
                    [chatId]: unreadSnapshot.val() || 0,
                }));
            });
            
            const cleanup = () => off(unreadRef, 'value', unreadListener);
            currentListeners.set(chatId, cleanup);
        });
    });

    // Notifications listener (now role-specific)
    const notificationsRef = ref(database, `notifications/${identity}`);
    const notificationsListener = onValue(notificationsRef, (snapshot) => {
        const loaded: any[] = [];
        if(snapshot.exists()){
            snapshot.forEach(child => {
                if(!child.val().read) {
                    loaded.push({id: child.key, ...child.val()});
                }
            })
        }
        setNotifications(loaded.sort((a,b) => b.createdAt - a.createdAt));
    });

    // Cleanup function for the entire effect when user/identity changes or component unmounts
    return () => {
      off(userChatsRef, 'value', userChatsListener);
      activeChatUnreadListenersRef.current.forEach(cleanup => cleanup());
      activeChatUnreadListenersRef.current.clear();
      off(notificationsRef, 'value', notificationsListener);
    };
  }, [user, identity]);

  const handleStatusChange = (newStatus: ManualStatus) => {
    if (!user || role !== 'listener') return;

    const statusRef = ref(database, `users/${user.uid}/status`);
    set(statusRef, newStatus);
    setManualStatus(newStatus);
  };

  const getHomePath = () => (role === 'listener' ? '/listener' : '/member');

  const navItems = [
    { href: getHomePath(), icon: Home, label: 'Home' },
    { href: '/chats', icon: MessageCircle, label: 'Chats', badgeCount: unreadChatCount },
  ];

  const handleSignOut = async () => {
    sessionStorage.removeItem('adminAuthenticated');
    sessionStorage.removeItem('roleSelectedThisSession');
    await signOut(auth);
    router.push('/login');
  };
  
  const handleRoleSwitch = async () => {
    if (!user) return;
    const newRole = role === 'listener' ? 'member' : 'listener';
    
    if (newRole === 'listener' && !hasCompletedListenerProfile) {
        router.push('/listener/training');
    } else {
        await update(ref(database, `users/${user.uid}`), { role: newRole });
    }
  };
  
  const isItemActive = (href: string) => {
    if (href === getHomePath()) {
        const homePaths = ['/member', '/listener'];
        return homePaths.includes(pathname);
    }
    if (href === '/chats') {
        return pathname.startsWith('/chats') || pathname.startsWith('/chat/');
    }
    // For other paths like /profile or /settings, we don't want any nav item to be active.
    return false;
  };
  
  return (
    <>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 h-16 w-[calc(100%-1rem)] max-w-sm bg-background border shadow-lg rounded-2xl md:hidden z-40">
        <div className="grid h-full grid-cols-5 items-stretch">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} isActive={isItemActive(item.href)} />
          ))}

          {/* Center Action Button */}
          <div className="flex items-center justify-center">
             <div className="flex-shrink-0 -translate-y-4">
                {role === 'member' ? (
                  <button
                    onClick={() => setIsRequestDialogOpen(true)}
                    className="flex items-center justify-center w-16 h-16 bg-primary rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105"
                  >
                    {pendingRequest ? (
                      <div className="relative w-8 h-8">
                        <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping"></div>
                        <Search className="relative w-full h-full" />
                      </div>
                    ) : (
                        <HeartHandshake className="w-8 h-8" />
                    )}
                  </button>
                ) : (
                  <div className="relative">
                      <ListenerRequestNotifier isBottomNav={true} />
                  </div>
                )}
              </div>
          </div>
          
          {/* Notifications Popover */}
          <Popover onOpenChange={(open) => { if(!open) { handleMarkNotificationsAsRead(); }}}>
              <PopoverTrigger asChild>
                  <button className="group flex h-full flex-col items-center justify-center text-muted-foreground transition-colors hover:text-primary">
                      <div className={cn(
                        'relative flex items-center justify-center rounded-full transition-all duration-300 h-8 w-8'
                      )}>
                          <Bell className="w-6 h-6" />
                          {notifications.length > 0 && (
                              <span className="absolute top-0 right-0 flex min-w-[1rem] h-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                {notifications.length}
                              </span>
                          )}
                      </div>
                      <span className="block h-4 text-center text-xs">Alerts</span>
                  </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-60 mb-4 mr-2">
                  <Card className="border-none shadow-none">
                      <CardHeader className="p-2 pt-0">
                          <CardTitle className="text-base">Notifications</CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 pt-0">
                      {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center text-center py-8 px-4 border-2 border-dashed rounded-lg bg-card">
                              <Bell className="h-10 w-10 text-muted-foreground mb-3" />
                              <h3 className="text-lg font-semibold mb-1">No New Notifications</h3>
                              <p className="text-muted-foreground text-sm">You're all caught up!</p>
                          </div>
                      ) : (
                           <div className="space-y-2 max-h-64 overflow-y-auto">
                          {notifications.map(n => (
                              <div key={n.id} className="text-sm p-2 rounded-md bg-accent/50">
                                  {n.message}
                              </div>
                          ))}
                          </div>
                      )}
                      </CardContent>
                  </Card>
              </PopoverContent>
          </Popover>

          {/* Profile Popover */}
          <Popover>
            <PopoverTrigger asChild>
                <button className='group flex h-full flex-col items-center justify-center text-muted-foreground transition-colors hover:text-primary'>
                  <div
                    className='relative flex items-center justify-center rounded-full transition-all duration-300 h-8 w-8'
                  >
                     <div className="relative">
                        <Avatar className='h-7 w-7 transition-all'>
                            <AvatarImage src={photoURL || undefined} alt={screenName || 'User'}/>
                            <AvatarFallback>{getInitials(screenName)}</AvatarFallback>
                        </Avatar>
                        <span className={cn( "absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-background", getStatusColor(realtimeStatus) )} />
                    </div>
                  </div>
                  <span
                    className='block text-center text-xs transition-opacity duration-300 h-4'
                  >
                    Profile
                  </span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 mb-4 mr-2 p-1">
              <div className="px-2 py-1.5">
                  <p className="text-base font-semibold leading-tight truncate">{screenName || user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">{role}</p>
              </div>
              <Separator />
               {role === 'listener' && (
                <>
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Set Status</p>
                    <RadioGroup value={manualStatus} onValueChange={(v) => handleStatusChange(v as ManualStatus)}>
                      <div className="flex items-center space-x-2 cursor-pointer">
                        <RadioGroupItem value="available" id="available-popover" />
                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        <Label htmlFor="available-popover" className="cursor-pointer">Online</Label>
                      </div>
                      <div className="flex items-center space-x-2 cursor-pointer">
                        <RadioGroupItem value="busy" id="busy-popover" />
                        <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                        <Label htmlFor="busy-popover" className="cursor-pointer">Busy</Label>
                      </div>
                      <div className="flex items-center space-x-2 cursor-pointer">
                        <RadioGroupItem value="offline" id="offline-popover" />
                        <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                        <Label htmlFor="offline-popover" className="cursor-pointer">Offline</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Separator />
                </>
              )}
              <Button asChild variant="ghost" className="w-full justify-start h-auto py-1.5 text-sm">
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4"/> Profile
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start h-auto py-1.5 text-sm">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4"/> Settings
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start h-auto py-1.5 text-sm">
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4"/> Admin
                </Link>
              </Button>
               <Separator />
               <Button variant="ghost" className="w-full justify-start h-auto py-1.5 text-sm" onClick={() => setIsReportDialogOpen(true)}>
                  <AlertTriangle className="mr-2 h-4 w-4" /> Report an Issue
              </Button>
              <Separator />
                <Button variant="ghost" className="w-full justify-start h-auto py-1.5 text-sm" onClick={handleRoleSwitch}>
                  <Repeat className="mr-2 h-4 w-4" />
                  <span>
                    {role === 'listener'
                        ? (memberProfileCompleted ? 'Switch to Member' : 'Become a Member')
                        : (hasCompletedListenerProfile ? 'Switch to Listener' : 'Become a Listener')}
                  </span>
              </Button>
              <Separator />
              <Button variant="ghost" className="w-full justify-start text-destructive h-auto py-1.5 text-sm" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4"/> Sign Out
              </Button>
            </PopoverContent>
          </Popover>

        </div>
      </div>
      
      <ReportIssueDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} />
    </>
  );
}

function NavItem({ href, icon: Icon, label, isActive, badgeCount }: { href: string; icon: React.ElementType; label: string; isActive: boolean; badgeCount?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex h-full flex-col items-center justify-center text-muted-foreground transition-colors hover:text-primary',
        isActive && 'text-primary'
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-300',
          isActive
            ? 'h-12 w-12 -translate-y-1 bg-primary text-primary-foreground'
            : 'h-8 w-8'
        )}
      >
        <Icon className="h-6 w-6" />
        {badgeCount && badgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {badgeCount}
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          'block text-center text-xs transition-opacity duration-300 h-4',
          isActive ? 'opacity-0' : 'opacity-100'
        )}
      >
        {label}
      </span>
    </Link>
  );
}
