'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { database } from '@/lib/firebase';
import { ref, onValue, get, off } from 'firebase/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquareOff, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials, formatPreciseDistance, getStatusColor, getIdentitiesFromChatId, getUidFromIdentity, getRoleFromIdentity, type OtherParticipant } from '@/lib/chatUtils';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatInfo {
    id: string;
    otherUser: OtherParticipant;
    lastMessage?: string;
    lastMessageTimestamp?: number;
    unreadCount: number;
}

export default function ChatsPage() {
    const { user, identity } = useAuth();
    const router = useRouter();
    const [chats, setChats] = useState<{ [id: string]: ChatInfo }>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const activeListenersRef = useRef(new Map<string, () => void>());
    const isMobile = useIsMobile();

    const sortedChats = useMemo(() => {
      return Object.values(chats).sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))
    }, [chats]);

    useEffect(() => {
        // Immediately clear state and start loading when identity changes
        setChats({});
        setLoading(true);

        if (!user || !identity) {
            setLoading(false);
            return;
        }
    
        const activeListeners = activeListenersRef.current;
    
        const userChatsRef = ref(database, `user_chats/${identity}`);
        const userChatsListener = onValue(userChatsRef, (snapshot) => {
            const newChatIds = new Set<string>(snapshot.exists() ? Object.keys(snapshot.val()) : []);

            // Clean up listeners for chats that have been removed
            activeListeners.forEach((cleanup, existingChatId) => {
                if (!newChatIds.has(existingChatId)) {
                    cleanup();
                    activeListeners.delete(existingChatId);
                }
            });
            
            // If a chat was removed, update the state
            setChats(prev => {
                const newChats = { ...prev };
                let changed = false;
                Object.keys(newChats).forEach(chatId => {
                    if (!newChatIds.has(chatId)) {
                        delete newChats[chatId];
                        changed = true;
                    }
                });
                return changed ? newChats : prev;
            });

            // Add listeners for new chats
            newChatIds.forEach(chatId => {
                if (activeListeners.has(chatId)) return;

                let statusUnsubscribe: (() => void) | null = null;
                const chatRef = ref(database, `chats/${chatId}`);
                
                const chatListener = onValue(chatRef, async (chatSnapshot) => {
                    if (!chatSnapshot.exists()) return; 
                    
                    const chatData = chatSnapshot.val();
                    const participantIdentities = getIdentitiesFromChatId(chatId);
                    if (!participantIdentities) return;

                    const otherUserIdentity = participantIdentities.find(id => id !== identity);
                    if (!otherUserIdentity) return;

                    const otherUserId = getUidFromIdentity(otherUserIdentity);
                    
                    try {
                        const otherUserSnapshot = await get(ref(database, `users/${otherUserId}`));
                        if (!otherUserSnapshot.exists()) return;

                        const otherUserData = otherUserSnapshot.val();
                        const otherUserRole = getRoleFromIdentity(otherUserIdentity);
                        const roleSpecificProfile = otherUserData.roles?.[otherUserRole] || {};

                        const setupStatusListener = () => {
                             if (statusUnsubscribe) return;
                             const statusRef = ref(database, `status/${otherUserIdentity}`);
                             const statusListener = onValue(statusRef, (statusSnapshot) => {
                                 const newStatus = statusSnapshot.val()?.state || 'offline';
                                 setChats(prev => {
                                     if (!prev[chatId] || !prev[chatId].otherUser) return prev;
                                     if (prev[chatId].otherUser.status === newStatus) return prev;
                                     return {
                                         ...prev,
                                         [chatId]: {
                                             ...prev[chatId],
                                             otherUser: {
                                                 ...prev[chatId].otherUser,
                                                 status: newStatus,
                                             }
                                         }
                                     };
                                 });
                             });
                             statusUnsubscribe = () => off(statusRef, 'value', statusListener);
                        }

                        setChats(prev => ({
                            ...prev,
                            [chatId]: {
                                id: chatId,
                                otherUser: {
                                    identity: otherUserIdentity,
                                    uid: otherUserId,
                                    screenName: roleSpecificProfile.screenName || 'Unknown User',
                                    photoURL: roleSpecificProfile.photoURL,
                                    role: otherUserRole,
                                    status: prev[chatId]?.otherUser?.status || 'offline',
                                },
                                lastMessage: chatData.lastMessage,
                                lastMessageTimestamp: chatData.lastMessageTimestamp,
                                unreadCount: chatData.unread?.[identity] || 0,
                            }
                        }));
                        
                        setupStatusListener();
                        setLoading(false);
                    } catch(error) {
                        console.error('Error fetching user data for chat list:', error);
                    }
                });

                const cleanup = () => {
                    off(chatRef, 'value', chatListener);
                    statusUnsubscribe?.();
                };
                activeListeners.set(chatId, cleanup);
            });

            if (newChatIds.size === 0) {
               setLoading(false);
            }
        });
    
        return () => {
            off(userChatsRef, 'value', userChatsListener);
            activeListeners.forEach(cleanupFunc => cleanupFunc());
            activeListeners.clear();
        };
    }, [user, identity]);

    const filteredChats = sortedChats.filter(chat =>
      chat.otherUser.screenName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const containerHeight = isMobile ? 'h-[calc(100vh-9rem)]' : 'h-[calc(100vh-4rem)]';

    const renderLoadingState = () => (
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">Conversations</h1>
            <p className="text-muted-foreground md:text-xl/relaxed">Your recent chats for your active role will appear here.</p>
        </div>
        <Card>
            <CardContent className="p-0">
                <div className="divide-y">
                    {[...Array(3)].map((_, i) => (
                         <div key={i} className="flex items-center gap-4 p-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                         </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    );

    if (loading) {
        return renderLoadingState();
    }


    return (
        <div className={cn("container mx-auto max-w-4xl flex flex-col p-4 md:p-8", containerHeight)}>
          {/* Static Header Part */}
          <div className="flex-shrink-0">
            <div className="space-y-2 mb-8">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">Conversations</h1>
              <p className="text-muted-foreground md:text-xl/relaxed">Your recent chats for your active role.</p>
            </div>

            {sortedChats.length >= 2 && (
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>
            
          {/* Scrollable List Part */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              {filteredChats.length > 0 ? (
                  <Card className="border border-border">
                      <CardContent className="p-0">
                          <div className="divide-y">
                              {filteredChats.map(chat => (
                                  <div 
                                      key={chat.id} 
                                      className={cn(
                                          "flex items-start gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                                          chat.unreadCount > 0 && "bg-primary/10"
                                      )}
                                      onClick={(e) => {
                                          if ((e.target as HTMLElement).closest('.avatar-link')) return;
                                          router.push(`/chat/${chat.id}`);
                                      }}
                                  >
                                      <div className="relative">
                                          <Link 
                                              href={`/profile/${chat.otherUser.uid}`} 
                                              onClick={(e) => e.stopPropagation()} 
                                              className="avatar-link"
                                          >
                                              <Avatar className="h-12 w-12 border">
                                                  <AvatarImage src={chat.otherUser.photoURL} alt={chat.otherUser.screenName || 'User'} />
                                                  <AvatarFallback>{getInitials(chat.otherUser.screenName)}</AvatarFallback>
                                              </Avatar>
                                          </Link>
                                          <span className={cn(
                                              "absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-background",
                                              getStatusColor(chat.otherUser.status)
                                          )} />
                                      </div>
                                      <div className="flex-1 grid gap-1">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                  <p className={cn("font-semibold", chat.unreadCount > 0 && "font-bold")}>{chat.otherUser.screenName}</p>
                                                  {chat.otherUser.role && (
                                                      <Badge variant={chat.otherUser.role === 'listener' ? "outline" : "secondary"}>
                                                          {chat.otherUser.role.charAt(0).toUpperCase()}
                                                      </Badge>
                                                  )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  {chat.lastMessageTimestamp && (
                                                      <p className="text-xs text-muted-foreground">
                                                          {formatPreciseDistance(chat.lastMessageTimestamp)}
                                                      </p>
                                                  )}
                                                  {chat.unreadCount > 0 && (
                                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                                          {chat.unreadCount}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                          <p className={cn("text-sm text-muted-foreground truncate", chat.unreadCount > 0 && "font-semibold text-foreground/90")}>{chat.lastMessage || 'No messages yet'}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </CardContent>
                  </Card>
              ) : (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-card h-full">
                      <MessageSquareOff className="h-12 w-12 text-muted-foreground mb-4"/>
                      <h3 className="text-xl font-semibold mb-2">
                          {searchQuery ? 'No Results Found' : 'No Conversations Yet'}
                      </h3>
                      <p className="text-muted-foreground">
                          {searchQuery ? `No chats match "${searchQuery}".` : "When you start a chat, it will appear here."}
                      </p>
                  </div>
              )}
            </ScrollArea>
          </div>
        </div>
    );
}
