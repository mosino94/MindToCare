'use client';

import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { auth, database } from '@/lib/firebase';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User as UserIcon, MessageCircle, Shield, Bell, Settings, Repeat, Home, AlertTriangle, BookMarked, Loader2, Plus, BookOpen, Pencil, Trash2, Search, X, Maximize2, Minimize2 } from 'lucide-react';
import { Icons } from './icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo, useRef } from 'react';
import { ref, onValue, off, update, set, push, serverTimestamp } from 'firebase/database';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ThemeToggle } from './theme-toggle';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { getInitials, getStatusColor } from '@/lib/chatUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { NewJournalDialog } from '@/components/new-journal-dialog';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';

const moodEmojis: { [key: string]: string } = {
    Happy: '😄',
    Sad: '😢',
    Neutral: '😐',
    Excited: '🎉',
    Calm: '😌',
    Anxious: '😟',
    Grateful: '🙏',
};

const createSnippet = (html: string, length = 50) => {
    if (!html) return '';
    const text = html.replace(/<[^>]+>/g, '');
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
};

function ViewJournalDialog({
    journal,
    open,
    onOpenChange
}: {
    journal: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!open) setIsFullscreen(false);
    }, [open]);

    if (!journal) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "flex flex-col p-0 transition-all duration-300 overflow-hidden",
                isFullscreen 
                    ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none border-none z-[100]" 
                    : "sm:max-w-2xl max-h-[90vh] rounded-lg"
            )}>
                <DialogHeader className="p-6 pb-2 shrink-0 border-b relative">
                    <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-foreground" 
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                            </Button>
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                            <DialogTitle className="text-xl md:text-2xl font-bold break-words whitespace-normal leading-tight text-left">
                                {journal.title}
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-2">
                                {journal.mood && <span className="text-lg" title={journal.mood}>{moodEmojis[journal.mood]}</span>}
                                <span>{journal.createdAt && format(journal.createdAt.toDate(), 'd MMMM yyyy, h:mm a')}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
                    <div
                        className="prose dark:prose-invert max-w-none break-words whitespace-normal"
                        dangerouslySetInnerHTML={{ __html: journal.content || '' }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

function JournalPopoverContent({
    setIsNewJournalOpen,
    setEditData,
    setViewJournal,
    onClose
}: {
    setIsNewJournalOpen: (open: boolean) => void;
    setEditData: (data: any) => void;
    setViewJournal: (journal: any) => void;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const db = useFirestore();
    const { toast } = useToast();

    const q = useMemoFirebase(() => {
        if (user && db) {
            return query(
                collection(db, 'users', (user as any).uid, 'journals'),
                orderBy('createdAt', 'desc')
            ) as any;
        }
        return null;
    }, [user, db]);

    const { data: journals, isLoading } = useCollection(q);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredJournals = useMemo(() => {
        if (!journals) return [];
        const activeJournals = journals.filter(j => j.status !== 'deleted');
        if (!searchTerm.trim()) return activeJournals;

        const term = searchTerm.toLowerCase();
        return activeJournals.filter(journal =>
            journal.title?.toLowerCase().includes(term) ||
            journal.content?.toLowerCase().includes(term)
        );
    }, [journals, searchTerm]);

    const handleEdit = (journal: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditData({
            id: journal.id,
            title: journal.title,
            content: journal.content,
            mood: journal.mood,
            createdAt: journal.createdAt?.toDate() || new Date(),
        });
        setIsNewJournalOpen(true);
        onClose();
    };

    const handleDelete = async (journalId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !db) return;

        try {
            const docRef = doc(db, 'users', user.uid, 'journals', journalId);
            await updateDoc(docRef, { status: 'deleted' });
            toast({
                title: 'Journal Deleted',
                description: 'Your journal entry has been deleted.',
            });
        } catch (error) {
            console.error('Error deleting journal:', error);
            toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: 'Could not delete journal. Please try again.',
            });
        }
    };

    const handleView = (journal: any) => {
        setViewJournal(journal);
        onClose();
    };

    const handleNew = () => {
        setEditData(null);
        setIsNewJournalOpen(true);
        onClose();
    };

    return (
        <PopoverContent align="end" className="w-80 mt-2 p-0">
            <Card className="border-none shadow-none relative h-[500px] flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 shrink-0">
                    <CardTitle className="text-lg font-headline">My Journal</CardTitle>
                </CardHeader>
                <div className="px-4 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search keywords..."
                            className="h-8 pl-8 pr-8 text-xs bg-accent/50 border-none focus-visible:ring-1"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                <CardContent className="p-0 flex-1 overflow-hidden relative">
                    <ScrollArea className="h-full">
                        <div className="p-4 pt-0">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredJournals && filteredJournals.length > 0 ? (
                                <ul className="space-y-2 mb-16">
                                    {filteredJournals.map((journal) => (
                                        <li key={journal.id} className="group">
                                            <div
                                                className="p-3 rounded-md hover:bg-accent cursor-pointer transition-colors"
                                                onClick={() => handleView(journal)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold line-clamp-1 flex-1 break-words whitespace-normal text-left">{journal.title}</p>
                                                            {journal.mood && <span title={journal.mood}>{moodEmojis[journal.mood]}</span>}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 text-left">
                                                            {journal.createdAt && format(journal.createdAt.toDate(), 'd MMMM yyyy')}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1 break-all whitespace-normal text-left">
                                                            {createSnippet(journal.content)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={(e) => handleEdit(journal, e)}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                            onClick={(e) => handleDelete(journal.id, e)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center py-10">
                                    {searchTerm ? (
                                        <>
                                            <Search className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                                            <p className="text-sm text-muted-foreground px-4">No results for "{searchTerm}"</p>
                                        </>
                                    ) : (
                                        <>
                                            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
                                            <p className="text-sm text-muted-foreground">No journal entries yet.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="absolute bottom-4 right-4 z-10">
                        <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-12 w-12 rounded-full shadow-2xl hover:scale-110 transition-transform bg-red-600 hover:bg-red-700" 
                            onClick={handleNew}
                        >
                            <Plus className="h-6 w-6" />
                            <span className="sr-only">New Journal Entry</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </PopoverContent>
    );
}

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
                        Let us know what's wrong.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
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
                        <Label htmlFor="report-text">Details</Label>
                        <Textarea
                            id="report-text"
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            placeholder="Please provide details..."
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

export function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, role, screenName, photoURL, hasCompletedListenerProfile, memberProfileCompleted, identity, loading } = useAuth();
    const isMobile = useIsMobile();

    const [unreadCounts, setUnreadCounts] = useState<{ [chatId: string]: number }>({});
    const [notifications, setNotifications] = useState<any[]>([]);

    const [manualStatus, setManualStatus] = useState<ManualStatus>('offline');
    const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('offline');

    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [isNewJournalOpen, setIsNewJournalOpen] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [viewJournal, setViewJournal] = useState<any>(null);
    const [isJournalPopoverOpen, setIsJournalPopoverOpen] = useState(false);

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

    useEffect(() => {
        if (user && role === 'listener') {
            const manualStatusRef = ref(database, `users/${user.uid}/status`);
            const unsubscribe = onValue(manualStatusRef, (snapshot) => {
                setManualStatus(snapshot.val() || 'offline');
            });
            return () => unsubscribe();
        }
    }, [user, role]);

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
            activeChatUnreadListenersRef.current.forEach(cleanup => cleanup());
            activeChatUnreadListenersRef.current.clear();
            setUnreadCounts({});
            setNotifications([]);
            return;
        }

        const userChatsRef = ref(database, `user_chats/${identity}`);
        const userChatsListener = onValue(userChatsRef, (snapshot) => {
            const newChatIds = new Set<string>(snapshot.exists() ? Object.keys(snapshot.val()) : []);
            const currentListeners = activeChatUnreadListenersRef.current;

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

        const notificationsRef = ref(database, `notifications/${identity}`);
        const notificationsListener = onValue(notificationsRef, (snapshot) => {
            const loaded: any[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    if (!child.val().read) {
                        loaded.push({ id: child.key, ...child.val() });
                    }
                })
            }
            setNotifications(loaded.sort((a, b) => b.createdAt - a.createdAt));
        });

        return () => {
            off(userChatsRef, 'value', userChatsListener);
            activeChatUnreadListenersRef.current.forEach(cleanup => cleanup());
            activeChatUnreadListenersRef.current.clear();
            off(notificationsRef, 'value', notificationsListener);
        };
    }, [user, identity]);

    const getHomePath = () => {
        if (role === 'listener') return '/listener';
        return '/member';
    }

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

    const handleStatusChange = (newStatus: ManualStatus) => {
        if (!user || role !== 'listener') return;

        const statusRef = ref(database, `users/${user.uid}/status`);
        set(statusRef, newStatus);
        setManualStatus(newStatus);
    };

    const navItems = [
        { href: getHomePath(), icon: Home, label: 'Home' },
        { href: '/chats', icon: MessageCircle, label: 'Chats', badgeCount: unreadChatCount },
    ];

    const isItemActive = (href: string) => {
        if (href === getHomePath()) {
            return pathname === getHomePath();
        }
        if (href === '/chats') {
            return pathname.startsWith('/chats') || pathname.startsWith('/chat/');
        }
        return pathname.startsWith(href);
    };

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="container flex h-16 items-center px-4">
                    <Link
                        href={getHomePath()}
                        className="flex items-center gap-2 mr-6"
                    >
                        <Icons.logo className="h-6 w-auto" />
                        <h1 className="text-md md:text-lg font-bold font-headline">MindToCare</h1>
                    </Link>

                    <nav className="hidden md:flex items-center gap-4 lg:gap-6">
                        {navItems.map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    buttonVariants({ variant: 'ghost' }),
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    isItemActive(item.href) ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                                {item.badgeCount && item.badgeCount > 0 && (
                                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                        {item.badgeCount}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center justify-end space-x-1 ml-auto">
                        {(loading || role === 'member') ? (
                            <Popover open={isJournalPopoverOpen} onOpenChange={setIsJournalPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9">
                                        <BookMarked className="h-5 w-5" />
                                        <span className="sr-only">Journal</span>
                                    </Button>
                                </PopoverTrigger>
                                {!loading && (
                                    <JournalPopoverContent
                                        setIsNewJournalOpen={setIsNewJournalOpen}
                                        setEditData={setEditData}
                                        setViewJournal={setViewJournal}
                                        onClose={() => setIsJournalPopoverOpen(false)}
                                    />
                                )}
                            </Popover>
                        ) : null}

                        <ThemeToggle />

                        <div className="hidden md:flex items-center space-x-1">
                            <Popover onOpenChange={(open) => { if (!open) { handleMarkNotificationsAsRead(); } }}>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="relative h-9 w-9">
                                        <Bell className="h-5 w-5" />
                                        {!loading && notifications.length > 0 && (
                                            <span className="absolute top-1 right-1 flex min-w-[1rem] h-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                                {notifications.length}
                                            </span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                {!loading && (
                                    <PopoverContent align="end" className="w-80 mt-2">
                                        <Card className="border-none shadow-none">
                                            <CardHeader className="p-2 pt-0">
                                                <CardTitle className="text-base">Notifications</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 max-h-80 overflow-y-auto">
                                                {notifications.length === 0 ? (
                                                    <div className="text-center text-muted-foreground py-4">
                                                        <Bell className="h-8 w-8 mx-auto mb-2" />
                                                        <p className="text-sm">No new notifications.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
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
                                )}
                            </Popover>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={photoURL || user?.photoURL || undefined} alt={screenName || user?.displayName || 'User'} />
                                            <AvatarFallback>{getInitials(screenName || user?.displayName || user?.email)}</AvatarFallback>
                                        </Avatar>
                                        {!loading && (
                                            <span className={cn(
                                                "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
                                                getStatusColor(realtimeStatus)
                                            )} />
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                {!loading && (
                                    <DropdownMenuContent className="w-56" align="end" forceMount>
                                        <DropdownMenuLabel className="font-normal">
                                            <div className="flex flex-col space-y-1">
                                                <p className="text-sm font-medium leading-none truncate">{screenName || user?.displayName || user?.email}</p>
                                                <p className="text-xs leading-none text-muted-foreground capitalize">{role}</p>
                                            </div>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {role === 'listener' && (
                                            <>
                                                <div className="p-2">
                                                    <p className="text-xs font-medium text-muted-foreground mb-2">Set Status</p>
                                                    <RadioGroup value={manualStatus} onValueChange={(v) => handleStatusChange(v as ManualStatus)}>
                                                        <div className="flex items-center space-x-2 cursor-pointer">
                                                            <RadioGroupItem value="available" id="available-header" />
                                                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                                            <Label htmlFor="available-header" className="cursor-pointer text-sm font-normal">Online</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2 cursor-pointer">
                                                            <RadioGroupItem value="busy" id="busy-header" />
                                                            <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                                                            <Label htmlFor="busy-header" className="cursor-pointer text-sm font-normal">Busy</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2 cursor-pointer">
                                                            <RadioGroupItem value="offline" id="offline-header" />
                                                            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                                                            <Label htmlFor="offline-header" className="cursor-pointer text-sm font-normal">Offline</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                                <DropdownMenuSeparator />
                                            </>
                                        )}
                                        <DropdownMenuItem asChild>
                                            <Link href="/profile">
                                                <UserIcon className="mr-2 h-4 w-4" />
                                                <span>Profile</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/settings">
                                                <Settings className="mr-2 h-4 w-4" />
                                                <span>Settings</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin">
                                                <Shield className="mr-2 h-4 w-4" />
                                                <span>Admin</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)}>
                                            <AlertTriangle className="mr-2 h-4 w-4" />
                                            <span>Report an Issue</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleRoleSwitch}>
                                            <Repeat className="mr-2 h-4 w-4" />
                                            <span>
                                                {role === 'listener'
                                                    ? (memberProfileCompleted ? 'Switch to Member' : 'Become a Member')
                                                    : (hasCompletedListenerProfile ? 'Switch to Listener' : 'Become a Listener')}
                                            </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span>Sign Out</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                )}
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </header>
            <NewJournalDialog
                open={isNewJournalOpen}
                onOpenChange={(open) => {
                    setIsNewJournalOpen(open);
                    if (!open) setEditData(null);
                }}
                editData={editData}
            />
            <ViewJournalDialog
                journal={viewJournal}
                open={!!viewJournal}
                onOpenChange={(open) => { if (!open) setViewJournal(null); }}
            />
            {!isMobile && <ReportIssueDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} />}
        </>
    );
}
