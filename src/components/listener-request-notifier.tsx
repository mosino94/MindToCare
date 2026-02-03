'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { database } from '@/lib/firebase';
import { ref, onValue, get, query, equalTo, orderByChild, update, serverTimestamp } from 'firebase/database';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Phone, Tag, Clock, ArrowRight, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/chatUtils';

type CommunicationMethod = 'text' | 'call';

interface Request {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  topics: string[];
  details: string;
  communicationMethod: CommunicationMethod;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: number;
  memberStatus?: { state: 'online' | 'offline' | 'busy', last_changed: number };
  memberPhotoURL?: string;
}

export function ListenerRequestNotifier({ isBottomNav = false }: { isBottomNav?: boolean }) {
  const { user, role, identity } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  useEffect(() => {
    if (!user || role !== 'listener') {
      setLoading(false);
      setRequests([]);
      return;
    }

    setLoading(true);

    const processRequests = (requestsData: any, statusesData: any) => {
      const promises: Promise<Request | null>[] = [];
      const now = Date.now();

      if (requestsData) {
        Object.keys(requestsData).forEach(key => {
          const request = { id: key, ...requestsData[key] };
          if (request.memberId === user.uid) return;

          const memberIdentity = `${request.memberId}_member`;
          const memberStatus = statusesData[memberIdentity];
          const isOnline = memberStatus?.state === 'online';

          let shouldShow = false;

          if (isOnline) {
            shouldShow = true;
          } else {
            // Member is offline
            const lastChanged = memberStatus?.last_changed || request.createdAt;
            const timeOffline = now - lastChanged;

            if (request.communicationMethod === 'call') {
              // Immediately cancel call requests from offline users
              if (request.status === 'pending') {
                  update(ref(database, `requests/${request.id}`), { status: 'cancelled' });
              }
            } else if (request.communicationMethod === 'text') {
              if (timeOffline > 10 * 60 * 1000) { // 10 minutes in milliseconds
                // Cancel text requests if offline for more than 10 mins
                 if (request.status === 'pending') {
                    update(ref(database, `requests/${request.id}`), { status: 'cancelled' });
                 }
              } else {
                // Show text requests if offline for less than 10 mins
                shouldShow = true;
              }
            }
          }

          if (shouldShow) {
            const promise = get(ref(database, `users/${request.memberId}`)).then(userSnapshot => {
              if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const memberProfile = userData.roles?.member || {};
                return {
                  ...request,
                  memberPhotoURL: memberProfile.photoURL,
                  memberStatus
                } as Request;
              }
              return null;
            });
            promises.push(promise);
          }
        });
      }

      Promise.all(promises).then((results) => {
        const validRequests = results.filter(Boolean) as Request[];
        setRequests(validRequests.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      });
    };

    const requestsRef = ref(database, 'requests');
    const pendingRequestsQuery = query(requestsRef, orderByChild('status'), equalTo('pending'));
    const statusRef = ref(database, 'status');

    let currentRequests: any = {};
    let currentStatuses: any = {};

    const requestsUnsubscribe = onValue(pendingRequestsQuery, (snapshot) => {
      currentRequests = snapshot.val();
      processRequests(currentRequests, currentStatuses);
    });

    const statusUnsubscribe = onValue(statusRef, (snapshot) => {
      currentStatuses = snapshot.val() || {};
      processRequests(currentRequests, currentStatuses);
    });

    return () => {
      requestsUnsubscribe();
      statusUnsubscribe();
    };
  }, [user, role]);

  const handleAcceptRequest = async (request: Request) => {
    if (!user || !identity || user.uid === request.memberId) return;

    setIsRequestDialogOpen(false);

    const requestRef = ref(database, `requests/${request.id}`);
    
    const requestSnapshot = await get(requestRef);
    if (!requestSnapshot.exists() || requestSnapshot.val().status !== 'pending') {
      toast({
        variant: 'destructive',
        title: 'Request No Longer Available',
        description: 'Someone else may have already accepted this request.',
      });
      return;
    }
    
    const updates: { [key: string]: any } = {};
    const acceptedAt = serverTimestamp();

    updates[`requests/${request.id}/status`] = 'accepted';
    updates[`requests/${request.id}/listenerId`] = user.uid;
    updates[`requests/${request.id}/acceptedAt`] = acceptedAt;

    if (request.communicationMethod === 'text') {
        const memberIdentity = `${request.memberId}_member`;
        const chatId = [identity, memberIdentity].sort().join('__');
        
        const chatRef = ref(database, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);

        if (!chatSnapshot.exists()) {
            updates[`/chats/${chatId}`] = {
                participants: {
                    [identity]: true,
                    [memberIdentity]: true,
                },
                systemType: 'listener-member',
                createdAt: serverTimestamp(),
                lastMessageTimestamp: serverTimestamp(),
            };
        } else {
            updates[`/chats/${chatId}/lastMessageTimestamp`] = serverTimestamp();
        }
        
        updates[`/user_chats/${identity}/${chatId}`] = serverTimestamp();
        updates[`/user_chats/${memberIdentity}/${chatId}`] = serverTimestamp();
        
        await update(ref(database), updates);
        router.push(`/chat/${chatId}`);
    } else {
        await update(ref(database), updates);
    }
  };

  const getIcon = (method: CommunicationMethod) => {
    if (method === 'call') return <Phone className="h-5 w-5" />;
    return <MessageSquare className="h-5 w-5" />;
  }

  const renderRequestList = () => {
    if (loading) {
      return (
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                 <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-16" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                 <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                 </div>
              </CardContent>
              <CardFooter>
                 <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-card mt-8">
            <h3 className="text-xl font-semibold mb-2">No Pending Requests</h3>
            <p className="text-muted-foreground">Check back soon to help someone in need.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2">
        {requests.map((request) => (
          <Card key={request.id} className="flex flex-col">
            <CardHeader>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Avatar className="h-6 w-6">
                          <AvatarImage src={request.memberPhotoURL} alt={request.memberName || 'Member'} />
                          <AvatarFallback>{getInitials(request.memberName)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{request.memberName || 'Anonymous Member'}</span>
                  </div>
                   <div className={cn("flex items-center gap-2 text-sm font-semibold", 
                      request.communicationMethod === 'call' ? 'text-blue-500' : 'text-green-500'
                   )}>
                      {getIcon(request.communicationMethod)}
                      <span>{request.communicationMethod.charAt(0).toUpperCase() + request.communicationMethod.slice(1)}</span>
                  </div>
              </div>
               <div className="text-sm text-muted-foreground flex items-center gap-2 pt-2">
                  <Clock className="h-4 w-4"/>
                  <time dateTime={new Date(request.createdAt).toISOString()}>
                  {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </time>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              
              <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2 text-sm"><Tag className="h-4 w-4 text-muted-foreground"/> Topics</h4>
                  <div className="flex flex-wrap gap-2">
                      {request.topics.map(topic => (
                      <Badge key={topic} variant="secondary">{topic}</Badge>
                      ))}
                  </div>
              </div>
              {request.details && (
                <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-sm">Details</h4>
                    <p className="text-muted-foreground bg-accent/20 p-3 rounded-md border text-sm">{request.details}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleAcceptRequest(request)} disabled={user?.uid === request.memberId} className="w-full">
                Accept Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };
  
  if (!user || role !== 'listener' || !isBottomNav) {
    return null;
  }
  
  if (isBottomNav) {
      if (loading) {
          return <Skeleton className="h-16 w-16 rounded-full" />;
      }
      return (
         <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
                <button
                    className={cn("flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-transform hover:scale-105", 
                        requests.length > 0 ? 'bg-primary text-primary-foreground ring-4 ring-background' : 'bg-muted text-muted-foreground'
                    )}
                >
                    {requests.length > 0 ? (
                        <div className="relative">
                            <UserPlus className="w-8 h-8" />
                            <span className="absolute -top-1 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold animate-pulse">
                                {requests.length}
                            </span>
                        </div>
                    ) : (
                        <UserPlus className="w-8 h-8" />
                    )}
                </button>
            </DialogTrigger>
             <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
                <DialogHeader>
                <DialogTitle className="text-2xl font-headline">Pending Requests</DialogTitle>
                <DialogDescription>
                    Here are the members waiting for a listener.
                </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="py-4">
                        {renderRequestList()}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      )
  }

  return null;
}
