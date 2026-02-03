'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { database } from '@/lib/firebase';
import { ref, onValue, update, get, off } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Wifi, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Loading from '../loading';
import { getInitials, getStatusColor } from '@/lib/chatUtils';
import { AdminLogin } from './admin-login';


interface DisplayUser {
  uid: string;
  identity: string;
  role: 'member' | 'listener';
  name: string;
  screenName: string | null;
  photoURL?: string;
  status: 'online' | 'busy' | 'offline';
}

interface Report {
    id: string;
    userId: string;
    email: string;
    report: string;
    category: string;
    createdAt: number;
    status: 'new' | 'in_progress' | 'resolved';
}

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [users, setUsers] = useState<any>({});
  const [statuses, setStatuses] = useState<any>({});
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const isAdmin = useMemo(() => role === 'admin' || isAuthenticated, [role, isAuthenticated]);

  // Listener for users
    useEffect(() => {
        if (loading || !isAdmin) return;
        const usersRef = ref(database, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            setUsers(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, [loading, isAdmin]);

    // Listener for statuses
    useEffect(() => {
        if (loading || !isAdmin) return;
        const statusRef = ref(database, 'status');
        const unsubscribe = onValue(statusRef, (snapshot) => {
            setStatuses(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, [loading, isAdmin]);

    // Listener for reports
    useEffect(() => {
        if (loading || !isAdmin) return;
        const reportsRef = ref(database, 'reports');
        const unsubscribe = onValue(reportsRef, (snapshot) => {
            const loadedReports: Report[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    loadedReports.push({ id: childSnapshot.key!, ...childSnapshot.val() });
                });
            }
            setReports(loadedReports.sort((a, b) => b.createdAt - a.createdAt));
        });
        return () => unsubscribe();
    }, [loading, isAdmin]);

    // Combine user and status data for display
    const allUserProfiles = useMemo(() => {
        const profiles: DisplayUser[] = [];
        Object.keys(users).forEach(uid => {
            const userData = users[uid];
            if (!userData) return;

            const hasMemberRole = !!userData.roles?.member;
            const hasListenerRole = !!userData.roles?.listener;
            const hasBothRoles = hasMemberRole && hasListenerRole;

            const processRole = (userRole: 'member' | 'listener') => {
                if (userData.roles?.[userRole]) {
                    const identity = `${uid}_${userRole}`;
                    const roleProfile = userData.roles[userRole];
                    
                    let displayName: string;
                    if (hasBothRoles) {
                        displayName = userData.name || 'Unnamed User';
                    } else {
                        displayName = roleProfile.screenName || userData.name || 'Unnamed User';
                    }

                    profiles.push({
                        uid,
                        identity,
                        role: userRole,
                        name: displayName,
                        screenName: roleProfile.screenName,
                        photoURL: roleProfile.photoURL,
                        status: statuses[identity]?.state || 'offline',
                    });
                }
            };
            
            if (hasMemberRole) processRole('member');
            if (hasListenerRole) processRole('listener');
        });
        return profiles.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, statuses]);

    const usersWithBothRoles = useMemo(() => {
        const uidsWithBoth = Object.keys(users).filter(uid => users[uid]?.roles?.member && users[uid]?.roles?.listener);
        // We only want one entry per user with both roles. Let's just pick the member role identity to be consistent.
        return allUserProfiles.filter(p => uidsWithBoth.includes(p.uid) && p.role === 'member');
    }, [allUserProfiles, users]);

    const onlyListeners = useMemo(() => {
        const uidsOnlyListener = Object.keys(users).filter(uid => users[uid]?.roles?.listener && !users[uid]?.roles?.member);
        return allUserProfiles.filter(p => uidsOnlyListener.includes(p.uid) && p.role === 'listener');
    }, [allUserProfiles, users]);

    const onlyMembers = useMemo(() => {
        const uidsOnlyMember = Object.keys(users).filter(uid => users[uid]?.roles?.member && !users[uid]?.roles?.listener);
        return allUserProfiles.filter(p => uidsOnlyMember.includes(p.uid) && p.role === 'member');
    }, [allUserProfiles, users]);


  if (loading) {
    return <Loading />;
  }
  
  if (!isAuthenticated && role !== 'admin') {
    return (
        <div className="flex flex-1 items-center justify-center p-4 h-full">
            <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />
        </div>
    );
  }

  const totalCount = Object.keys(users).length;
  const activeCount = Object.values(statuses).filter((s: any) => s?.state === 'online' || s?.state === 'busy').length;
  
  const handleReportStatusChange = async (reportId: string, newStatus: Report['status']) => {
    const reportRef = ref(database, `reports/${reportId}`);
    await update(reportRef, { status: newStatus });
  };
  
  const statusBadgeVariant = (status: Report['status']) => {
      switch (status) {
          case 'new': return 'destructive';
          case 'in_progress': return 'secondary';
          case 'resolved': return 'default';
          default: return 'outline';
      }
  }
  
  const renderUserList = (usersToRender: DisplayUser[], showRoleBadge = true) => (
       <div className="space-y-4 m-0">
            {usersToRender.map(user => (
             <Link href={`/profile/${user.uid}`} key={user.identity} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted">
                <div className="relative">
                    <Avatar>
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className={cn(
                        "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
                        getStatusColor(user.status)
                    )} />
                </div>
                <div className="font-medium">{user.name}</div>
                {showRoleBadge && <Badge variant={user.role === 'listener' ? 'outline' : 'secondary'} className="capitalize ml-auto">{user.role}</Badge>}
            </Link>
        ))}
       </div>
   );

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">Admin Panel</h1>
        <p className="text-muted-foreground md:text-xl/relaxed">
          An overview of your MindToCare community.
        </p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Reports
                {reports.filter(r => r.status === 'new').length > 0 && (
                    <Badge variant="destructive">{reports.filter(r => r.status === 'new').length}</Badge>
                )}
            </div>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
           <div className="grid gap-4 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCount}</div>
                <p className="text-xs text-muted-foreground">All registered accounts</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Wifi className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCount}</div>
                <p className="text-xs text-muted-foreground">Users currently online or busy</p>
              </CardContent>
            </Card>
          </div>
            <Card>
                <Tabs defaultValue="all" className="w-full">
                    <CardHeader>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="all">Both Roles ({usersWithBothRoles.length})</TabsTrigger>
                            <TabsTrigger value="listeners">Only Listeners ({onlyListeners.length})</TabsTrigger>
                            <TabsTrigger value="members">Only Members ({onlyMembers.length})</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent className="space-y-0 max-h-96 overflow-y-auto">
                        <TabsContent value="all">
                           {renderUserList(usersWithBothRoles, false)}
                        </TabsContent>
                        <TabsContent value="listeners">
                           {renderUserList(onlyListeners)}
                        </TabsContent>
                        <TabsContent value="members">
                           {renderUserList(onlyMembers)}
                        </TabsContent>
                    </CardContent>
                </Tabs>
            </Card>
        </TabsContent>
        <TabsContent value="reports">
            <Card>
                <CardHeader>
                    <CardTitle>User Reports</CardTitle>
                    <CardDescription>Issues and feedback submitted by users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {reports.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            No reports found.
                        </div>
                    ) : (
                        reports.map(report => (
                            <Card key={report.id} className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                        {report.category && <Badge variant="outline" className="mb-2">{report.category}</Badge>}
                                        <p className="text-sm font-medium">{report.report}</p>
                                        <div className="text-xs text-muted-foreground">
                                            Reported by <Link href={`/profile/${report.userId}`} className="font-semibold text-primary hover:underline">{report.email}</Link>
                                            <span> · {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={statusBadgeVariant(report.status)}>{report.status}</Badge>
                                        <Select
                                            value={report.status}
                                            onValueChange={(value) => handleReportStatusChange(report.id, value as Report['status'])}
                                        >
                                            <SelectTrigger className="w-[120px] h-8 text-xs">
                                                <SelectValue placeholder="Change status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">New</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="resolved">Resolved</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
