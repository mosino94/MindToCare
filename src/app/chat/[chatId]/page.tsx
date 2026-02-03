
'use client';

import { useState, useEffect, useRef, Fragment, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { database } from '@/lib/firebase';
import { ref, onValue, push, serverTimestamp, get, remove, update, runTransaction, off, set, query, orderByChild, equalTo, onDisconnect } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowLeft, MoreVertical, Maximize, Minimize, Star, Heart, CornerUpLeft, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { ReviewDialog } from '@/components/review-dialog';
import { TypingIndicator } from '@/components/typing-indicator';
import { getInitials, getDateSeparator, getUidFromIdentity, getRoleFromIdentity, getIdentitiesFromChatId } from '@/lib/chatUtils';

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  heartedBy?: { [key: string]: boolean };
  replyTo?: {
    messageId: string;
    text: string;
    senderScreenName: string;
  };
}

interface OtherParticipant {
    identity: string;
    uid: string;
    role: 'member' | 'listener';
    screenName: string | null;
    photoURL?: string;
}

const MEMBER_MESSAGE_THRESHOLD = 3;
const LISTENER_MESSAGE_THRESHOLD = 3;

export default function ChatPage() {
  const { user, role, screenName, identity } = useAuth();
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const { chatId } = params;
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherParticipant | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [reviewEligible, setReviewEligible] = useState(false);
  const [systemType, setSystemType] = useState<'listener-member' | 'member-member' | 'listener-listener' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const updateTypingStatus = useCallback((isTyping: boolean) => {
    if (identity && chatId) {
      const typingRef = ref(database, `chats/${chatId}/typing/${identity}`);
      if (isTyping) {
        set(typingRef, true);
        onDisconnect(typingRef).remove();
      } else {
        remove(typingRef);
      }
    }
  }, [identity, chatId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      updateTypingStatus(true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };
  
  const checkReviewEligibility = useCallback(() => {
    if (!user || !otherUser || role !== 'member' || otherUser.role !== 'listener' || hasAlreadyReviewed || reviewEligible) {
      return;
    }

    const memberMessages = messages.filter(m => m.senderId === identity && m.senderId !== 'system').length;
    const listenerMessages = messages.filter(m => m.senderId === otherUser.identity && m.senderId !== 'system').length;

    if (memberMessages >= MEMBER_MESSAGE_THRESHOLD && listenerMessages >= LISTENER_MESSAGE_THRESHOLD) {
      setReviewEligible(true);
      toast({
          title: "How was your session?",
          description: `Enjoying your chat with ${otherUser.screenName}? You can now leave a review.`,
          duration: 10000,
      });
    }
  }, [user, otherUser, role, hasAlreadyReviewed, reviewEligible, messages, identity, toast]);

  useEffect(() => {
    if (!reviewEligible) {
        checkReviewEligibility();
    }
  }, [messages, reviewEligible, checkReviewEligibility]);

 useEffect(() => {
    if (!user || !identity || !chatId) return;

    const participantIdentities = getIdentitiesFromChatId(chatId);
    if (!participantIdentities || !participantIdentities.includes(identity)) {
        router.push('/chats');
        return;
    }

    const otherUserIdentity = participantIdentities.find(id => id !== identity);
    if (!otherUserIdentity) {
        toast({ variant: 'destructive', title: 'Error', description: 'Chat partner could not be determined.' });
        router.push('/chats');
        return;
    }

    // --- Listener variables ---
    let messagesListener: any = null;
    let typingListener: any = null;
    let reviewListener: any = null;

    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const typingRef = ref(database, `chats/${chatId}/typing/${otherUserIdentity}`);
    let reviewQuery: any = null;

    // --- Set initial state ---
    set(ref(database, `chats/${chatId}/unread/${identity}`), 0);

    // --- Fetch initial data and then attach listeners ---
    get(ref(database, `chats/${chatId}`))
      .then(chatInfoSnapshot => {
        if (!chatInfoSnapshot.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Chat data is invalid or missing.' });
          router.push('/chats');
          return null; // Stop promise chain
        }
        setSystemType(chatInfoSnapshot.val().systemType);
        
        const otherUserId = getUidFromIdentity(otherUserIdentity);
        const otherUserRole = getRoleFromIdentity(otherUserIdentity);
        return get(ref(database, `users/${otherUserId}`)).then(userSnapshot => ({ userSnapshot, otherUserRole, otherUserId }));
      })
      .then(result => {
        if (!result) return; // Exit if previous promise failed
        const { userSnapshot, otherUserRole, otherUserId } = result;

        if (!userSnapshot.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Chat partner not found.' });
          router.push('/chats');
          return;
        }
        const userData = userSnapshot.val();
        const roleSpecificProfile = userData.roles?.[otherUserRole] || {};
        setOtherUser({
            identity: otherUserIdentity,
            uid: otherUserId,
            role: otherUserRole,
            screenName: roleSpecificProfile.screenName || 'Anonymous',
            photoURL: roleSpecificProfile.photoURL,
        });

        // --- ATTACH LISTENERS ---
        messagesListener = onValue(messagesRef, (snapshot) => {
            const loadedMessages: Message[] = [];
            snapshot.forEach(childSnapshot => {
                loadedMessages.push({ id: childSnapshot.key!, ...childSnapshot.val() });
            });
            setMessages(loadedMessages);
        });

        typingListener = onValue(typingRef, (snapshot) => {
            setIsOtherUserTyping(snapshot.val() === true);
        });

        if (otherUserRole === 'listener' && role === 'member' && user) {
            const reviewsRef = ref(database, `reviews/${otherUserId}`);
            reviewQuery = query(reviewsRef, orderByChild('memberId'), equalTo(user.uid));
            reviewListener = onValue(reviewQuery, (reviewSnapshot) => {
                setHasAlreadyReviewed(reviewSnapshot.exists());
            });
        }
      })
      .catch(error => {
        console.error("Error setting up chat listeners:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load chat data.' });
      });

    // --- Return cleanup function ---
    return () => {
        updateTypingStatus(false);
        if (messagesListener) off(messagesRef, 'value', messagesListener);
        if (typingListener) off(typingRef, 'value', typingListener);
        if (reviewListener && reviewQuery) off(reviewQuery, 'value', reviewListener);
    };
}, [chatId, user, identity, role, router, toast, updateTypingStatus]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherUserTyping]);

  const handleSendMessage = () => {
    // Early exit if message is empty or user context is missing
    if (newMessage.trim() === '' || !user || !identity || !otherUser || !chatId) return;

    // --- Capture all necessary data before clearing state ---
    const textToSend = newMessage;
    const currentReplyingTo = replyingToMessage;
    const currentUserIdentity = identity;
    const otherUserIdentity = otherUser.identity;
    const currentChatId = chatId;
    const currentUserScreenName = screenName;
    const otherUserScreenName = otherUser.screenName;


    // --- Immediate UI Updates ---
    setNewMessage('');
    setReplyingToMessage(null);
    
    // --- Deferred Database Operations ---
    // Defer the DB operations to ensure the UI updates instantly
    setTimeout(() => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        updateTypingStatus(false);
    
        const messagesRef = ref(database, `chats/${currentChatId}/messages`);
        const messageData: any = {
          text: textToSend,
          senderId: currentUserIdentity,
          timestamp: serverTimestamp(),
        };
    
        if (currentReplyingTo) {
          const repliedToSenderName =
            currentReplyingTo.senderId === currentUserIdentity ? currentUserScreenName : otherUserScreenName;
    
          messageData.replyTo = {
            messageId: currentReplyingTo.id,
            text: currentReplyingTo.text,
            senderScreenName: repliedToSenderName || 'User',
          };
        }
    
        push(messagesRef, messageData);
    
        const timestamp = serverTimestamp();
        const chatUpdates: { [key: string]: any } = {};
    
        chatUpdates[`/chats/${currentChatId}/lastMessage`] = textToSend;
        chatUpdates[`/chats/${currentChatId}/lastMessageTimestamp`] = timestamp;
    
        const participantIdentities = getIdentitiesFromChatId(currentChatId);
        if(participantIdentities) {
            participantIdentities.forEach((pIdentity) => {
              chatUpdates[`/user_chats/${pIdentity}/${currentChatId}`] = timestamp;
            });
        }
    
        update(ref(database), chatUpdates);
    
        const otherUserUnreadRef = ref(database, `chats/${currentChatId}/unread/${otherUserIdentity}`);
        runTransaction(otherUserUnreadRef, (count) => (count || 0) + 1);
    }, 0);
  };

  const handleEndSession = async () => {
    if (!user) return;

    const chatRef = ref(database, `chats/${chatId}`);
    await remove(chatRef);
    
    const userChatsUpdates: { [key: string]: any } = {};
    const participantIdentities = chatId.split('__');
    participantIdentities.forEach(pIdentity => {
        userChatsUpdates[`/user_chats/${pIdentity}/${chatId}`] = null;
    });
    await update(ref(database), userChatsUpdates);
    
    toast({
        title: 'Session Ended',
        description: 'The chat history has been deleted.',
    });
    
    router.push('/chats');
  };
  
  const handleReviewSubmit = async (rating: number, reviewText: string) => {
    if (!user || !otherUser || otherUser.role !== 'listener') {
      toast({ variant: 'destructive', title: 'Error', description: 'You can only review listeners.' });
      return;
    }
    
    if (hasAlreadyReviewed) {
        toast({ variant: 'destructive', title: 'Already Reviewed', description: 'You have already submitted a review for this listener.' });
        setIsReviewDialogOpen(false);
        return;
    }
    
    const reviewsRef = ref(database, `reviews/${otherUser.uid}`);
    const reviewRef = push(reviewsRef);
    await set(reviewRef, {
      rating,
      text: reviewText,
      memberId: user.uid,
      createdAt: serverTimestamp()
    });

    const listenerRef = ref(database, `users/${otherUser.uid}`);
    runTransaction(listenerRef, (listener) => {
      if (listener) {
        const reviewCount = (listener.roles.listener.reviewCount || 0) + 1;
        const totalRating = (listener.roles.listener.totalRating || 0) + rating;
        listener.roles.listener.rating = totalRating / reviewCount;
        listener.roles.listener.reviewCount = reviewCount;
        listener.roles.listener.totalRating = totalRating;
      }
      return listener;
    });

    toast({ title: 'Review Submitted!', description: 'Thank you for your feedback.' });
    setIsReviewDialogOpen(false);
  };
  
  const handleHeartClick = (messageId: string) => {
    if (!user) return;
    const messageReactionRef = ref(database, `chats/${chatId}/messages/${messageId}/heartedBy/${user.uid}`);
    set(messageReactionRef, true);
  };

  const handleReplyClick = (message: Message) => {
    setReplyingToMessage(message);
  }
  
  const canShowReviewOption = role === 'member' && otherUser?.role === 'listener' && !hasAlreadyReviewed && reviewEligible;
  
  let safetyTextMessage = "Welcome to your chat. Remember to be respectful and kind.";
    if (systemType === 'listener-member') {
        safetyTextMessage = "This is a supportive chat. For everyone's safety, please avoid sharing personal contact information and remember that listeners are not crisis counselors.";
    } else if (systemType === 'member-member') {
        safetyTextMessage = "You are chatting with another member. Be respectful, kind, and mindful of each other's privacy.";
    } else if (systemType === 'listener-listener') {
        safetyTextMessage = "You are chatting with a fellow listener. This is a space for peer support and connection.";
    }

  const displayedMessages: Message[] = [
    {
      id: 'system-safety-message',
      senderId: 'system',
      text: safetyTextMessage,
      timestamp: (messages.length > 0 ? messages[0].timestamp : Date.now()) - 1,
    },
    ...messages
  ];

  return (
    <>
      <div className={cn(
          "flex justify-center items-center flex-1",
          isFullScreen 
              ? "fixed inset-0 z-50 bg-background p-0" 
              : "p-4 md:p-6"
      )}>
          <Card className={cn(
              "w-full flex flex-col transition-all duration-300",
              isFullScreen 
                  ? 'h-full w-full rounded-none border-none' 
                  : 'max-w-4xl h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] shadow-lg'
          )}>
              <header className="flex items-center gap-4 border-b p-4 bg-muted/50">
                  <Button variant="ghost" size="icon" onClick={() => router.back()}>
                      <ArrowLeft />
                  </Button>
                  {otherUser ? (
                      <div className="flex items-center gap-4">
                          <Link href={`/profile/${otherUser.uid}`}>
                              <Avatar>
                                  <AvatarImage src={otherUser.photoURL} alt={otherUser.screenName || 'User'} />
                                  <AvatarFallback>{getInitials(otherUser?.screenName)}</AvatarFallback>
                              </Avatar>
                          </Link>
                           <div className="grid gap-0.5">
                            <h2 className="text-lg font-semibold flex-1">{otherUser?.screenName || 'Chat'}</h2>
                            {isOtherUserTyping && (
                                <p className="text-xs text-muted-foreground animate-pulse">typing...</p>
                            )}
                           </div>
                      </div>
                  ) : (
                      <div className="flex items-center gap-4">
                          <Avatar>
                              <AvatarFallback>??</AvatarFallback>
                          </Avatar>
                          <h2 className="text-lg font-semibold flex-1">Chat</h2>
                      </div>
                  )}
                  <div className="ml-auto flex items-center">
                      <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(prev => !prev)}>
                          {isFullScreen ? <Minimize /> : <Maximize />}
                      </Button>

                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                  <MoreVertical />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                              {canShowReviewOption && (
                                <DropdownMenuItem onClick={() => setIsReviewDialogOpen(true)}>
                                  <Star className="mr-2 h-4 w-4" />
                                  Leave a Review
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={handleEndSession} className="text-destructive">
                                  End Session
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
              </header>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {displayedMessages.map((message, index) => {
                      const prevMessage = displayedMessages[index-1];
                      const showDateSeparator = !prevMessage || !isSameDay(new Date(prevMessage.timestamp), new Date(message.timestamp));
                      const isCurrentUser = message.senderId === identity;
                      const isHeartedByYou = !!(message.heartedBy && user && message.heartedBy[user.uid]);
                      const isHeartedByOther = !!(message.heartedBy && Object.keys(message.heartedBy).some(id => id !== user?.uid));
                      
                      if (message.senderId === 'system') {
                        const parts = message.text.split('|');
                        const mainText = parts[0];
                        const time = parts[1];

                        return (
                          <Fragment key={message.id}>
                            {showDateSeparator && message.id !== 'system-safety-message' && (
                                <div className="flex items-center justify-center my-4">
                                    <div className="text-xs text-muted-foreground font-semibold bg-muted px-3 py-1 rounded-full">
                                        {getDateSeparator(new Date(message.timestamp))}
                                    </div>
                                </div>
                            )}
                            {message.id === 'system-safety-message' ? (
                                <div className="flex items-start gap-3 bg-muted/50 text-muted-foreground p-3 text-xs rounded-md my-4">
                                    <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <p>{mainText}</p>
                                </div>
                            ) : (
                                <div className="text-center text-xs text-muted-foreground my-4 space-y-1">
                                    <p>{mainText}</p>
                                    {time && <p className="text-muted-foreground/80">{time}</p>}
                                </div>
                            )}
                          </Fragment>
                        )
                      }
                      return (
                        <Fragment key={message.id}>
                          {showDateSeparator && (
                            <div className="flex items-center justify-center my-4">
                                <div className="text-xs text-muted-foreground font-semibold bg-muted px-3 py-1 rounded-full">
                                    {getDateSeparator(new Date(message.timestamp))}
                                </div>
                            </div>
                          )}
                           <div
                              className={cn(
                              'group flex items-end gap-2 max-w-xs md:max-w-md',
                              isCurrentUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                              )}
                          >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {isCurrentUser ? getInitials(screenName) : getInitials(otherUser?.screenName)}
                                </AvatarFallback>
                              </Avatar>
                               <div
                                className={cn(
                                    'rounded-lg px-3 py-2 text-sm flex flex-col',
                                    isCurrentUser
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                )}
                                >
                                {message.replyTo && (
                                    <div className={cn(
                                    "p-2 rounded-md mb-2 text-xs border-l-2",
                                    isCurrentUser ? "bg-primary-foreground/10 border-primary-foreground/50" : "bg-secondary border-muted-foreground"
                                    )}>
                                    <p className={cn("font-semibold", isCurrentUser ? "text-primary-foreground/80" : "text-foreground")}>
                                        {message.replyTo.senderScreenName}
                                    </p>
                                    <p className="line-clamp-2 break-all whitespace-pre-wrap text-muted-foreground">{message.replyTo.text}</p>
                                    </div>
                                )}
                                <p className="mb-1 break-all whitespace-pre-wrap">{message.text}</p>
                                <div className="flex items-end justify-between gap-4 mt-auto">
                                    <span className={cn("text-xs", isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground/70' )}>
                                        {message.timestamp ? format(new Date(message.timestamp), 'p') : ''}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {(isCurrentUser && isHeartedByOther) && (
                                            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                                        )}
                                        {!isCurrentUser && (
                                            <button className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full" onClick={() => handleHeartClick(message.id)}>
                                                <Heart className={cn("h-3 w-3", isHeartedByYou && 'fill-red-500 text-red-500')} />
                                            </button>
                                        )}
                                        <button className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full" onClick={() => handleReplyClick(message)}>
                                            <CornerUpLeft className="h-3 w-3"/>
                                        </button>
                                    </div>
                                </div>
                              </div>
                          </div>
                        </Fragment>
                      )
                  })}
                  {isOtherUserTyping && (
                      <TypingIndicator name={otherUser?.screenName || "User"} />
                  )}
                  <div ref={messagesEndRef} />
              </div>
              <div className="border-t p-4 pt-6 bg-muted/50">
                  {replyingToMessage && (
                    <div className="flex items-center justify-between bg-muted p-2 rounded-t-md text-sm">
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-muted-foreground">
                          Replying to {replyingToMessage.senderId === identity ? 'yourself' : otherUser?.screenName}
                        </p>
                        <p className="line-clamp-2 break-all whitespace-pre-wrap text-muted-foreground">{replyingToMessage.text}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyingToMessage(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="relative">
                      <Textarea
                          value={newMessage}
                          onChange={handleInputChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                          }}
                          placeholder="Type a message..."
                          className={cn("pr-12 resize-none min-h-[40px] max-h-[120px] hide-scrollbar", replyingToMessage && "rounded-t-none")}
                          rows={1}
                      />
                      <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                      >
                          <Send className="h-5 w-5" />
                      </Button>
                  </div>
              </div>
          </Card>
      </div>
      {otherUser && (
        <ReviewDialog
          open={isReviewDialogOpen}
          onOpenChange={setIsReviewDialogOpen}
          listenerName={otherUser.screenName || 'this listener'}
          onSubmit={handleReviewSubmit}
        />
      )}
    </>
  );
}
