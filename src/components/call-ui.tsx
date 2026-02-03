'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { PhoneOff, Mic, MicOff, MessageSquare, Send, X, Minimize2, ChevronsLeft, ChevronsRight, AlertCircle, UserX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useCall } from '@/hooks/use-call';
import { getInitials } from '@/lib/chatUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionUI, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleUI } from '@/components/ui/alert-dialog';


export function CallUI() {
  const { user, screenName, identity, role } = useAuth();
  const router = useRouter();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  const [newMessage, setNewMessage] = useState('');

  const {
    callId,
    callStatus,
    otherUser,
    isMuted,
    toggleMute,
    error,
    duration,
    endCall,
    remoteStream,
    messages,
    chatId,
    sendMessage,
    isCallUIVisible,
    setCallUIVisible,
    resetState,
    reconnectTimeLeft,
    endReason,
    rejoinRequest,
    rejoinTimeLeft,
    handleConfirmRejoin,
    handleDeclineRejoin,
  } = useCall();

  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callUIRef = useRef<HTMLDivElement>(null);
  
  const dragInfoRef = useRef({ isDragging: false, offset: { x: 0, y: 0 } });
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDocked, setIsDocked] = useState(false);
  const confirmClickedRef = useRef(false);


  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.error("Autoplay failed:", e));
    }
  }, [remoteStream]);

  const handleEndCallClick = useCallback(() => {
    if (callId) {
        setFinalDuration(duration);
        endCall(true, 'manual');
    }
  }, [callId, duration, endCall]);

  const handleGoHome = () => {
    resetState();
    router.push(role === 'listener' ? '/listener' : '/member');
  }
  
  const handleViewChat = () => {
    resetState();
    if(chatId) router.push(`/chat/${chatId}`)
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderStatus = () => {
    if (error) return "Error";
    switch (callStatus) {
      case 'initializing': return 'Initializing...';
      case 'permission-granted': return otherUser ? 'Ready' : 'Preparing call...';
      case 'connecting': return 'Connecting...';
      case 'connected': return formatDuration(duration);
      case 'reconnecting': 
        if (reconnectTimeLeft !== null) {
            return `Reconnecting... ${reconnectTimeLeft}`;
        }
        return "User disconnected. Reconnecting...";
      case 'disconnected': 
        if (endReason === 'timeout') return 'User did not reconnect';
        if (endReason === 'failed') return 'Call Failed';
        if (endReason === 'declined') return 'Call Declined';
        if (endReason === 'hangup') return 'User left the call';
        return 'Call Ended';
      default: return "Calling...";
    }
  }

  const handleSendMessage = () => {
    if (newMessage.trim() === '' || !user || !otherUser || !chatId) return;
    sendMessage(newMessage);
    setNewMessage('');
  };

   useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Drag and Drop handlers
  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!callUIRef.current) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input')) {
        return;
    }
    
    if (target.closest('[data-resizer]')) {
        return;
    }

    dragInfoRef.current.isDragging = true;
    const rect = callUIRef.current.getBoundingClientRect();
    dragInfoRef.current.offset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onDragMove = useCallback((e: PointerEvent) => {
    if (!dragInfoRef.current.isDragging || !callUIRef.current) return;
    e.preventDefault();
    const newX = e.clientX - dragInfoRef.current.offset.x;
    const newY = e.clientY - dragInfoRef.current.offset.y;
    
    const rect = callUIRef.current.getBoundingClientRect();
    if (newX + rect.width < 50 || newX > window.innerWidth - 50) {
      setIsDocked(true);
    } else {
      setPosition({ x: newX, y: newY });
    }
  }, []);

  const onDragEnd = useCallback((e: PointerEvent) => {
    if (dragInfoRef.current.isDragging) {
      dragInfoRef.current.isDragging = false;
      const target = e.target as HTMLElement;
      if (target && typeof target.releasePointerCapture === 'function' && target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    }
  }, []);
  
  useEffect(() => {
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    
    return () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
    }
  }, [onDragMove, onDragEnd]);

  
  const handleUndock = () => {
    setIsDocked(false);
    setPosition({ x: 20, y: 20 });
  };
  
  if (!callId && !rejoinRequest) {
    return null;
  }

  if(rejoinRequest) {
    return (
       <AlertDialog open={!!rejoinRequest} onOpenChange={(open) => {
           if (!open) {
               if (!confirmClickedRef.current) {
                   handleDeclineRejoin();
               }
               // Always reset the flag after the check.
               confirmClickedRef.current = false;
           }
       }}>
          <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()} className="max-w-[280px] p-4 text-center">
              <AlertDialogHeader>
                  <AlertDialogTitleUI className="text-2xl font-headline">Rejoin Call?</AlertDialogTitleUI>
                  <AlertDialogDescriptionUI className="px-2">
                      You were disconnected. Would you like to rejoin the call?
                  </AlertDialogDescriptionUI>
              </AlertDialogHeader>
              <div className="flex items-center justify-center py-2">
                  <div className="relative h-20 w-20">
                      <Loader2 className="absolute inset-0 h-full w-full animate-spin text-primary/20" />
                      <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-primary">
                          {rejoinTimeLeft}
                      </div>
                  </div>
              </div>
              <AlertDialogFooter className="pt-2 flex-col-reverse sm:flex-col-reverse gap-2 w-full">
                  <AlertDialogAction onClick={() => {
                        confirmClickedRef.current = true;
                        handleConfirmRejoin();
                  }} className="w-full">Rejoin</AlertDialogAction>
                  <AlertDialogCancel className="w-full mt-0">End Call</AlertDialogCancel>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    )
  }
  
  if (callStatus === 'disconnected') {
    const title = endReason === 'declined' ? 'Call Not Answered' : 'Call Ended';
    const description = endReason === 'declined' 
      ? `The other user did not answer the call.` 
      : endReason === 'hangup'
      ? `The other user has left the call.`
      : endReason === 'timeout'
      ? `The other user did not reconnect.`
      : `Your call has ended.`;
        
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md text-center animate-in fade-in-0">
              <CardHeader>
                  <CardTitle className="text-2xl">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                  <p className="text-xl">
                      Duration: <span className="font-semibold">{formatDuration(finalDuration === 0 ? duration : finalDuration)}</span>
                  </p>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                    <Button onClick={handleGoHome} className="w-full">Go to Home</Button>
                    {chatId && <Button onClick={handleViewChat} className="w-full" variant="outline">View Chat History</Button>}
              </CardFooter>
          </Card>
      </div>
    )
  }

  if (!isCallUIVisible) {
      return null;
  }
  
  if (isDocked) {
    return (
      <div 
        className={cn("fixed top-1/2 -translate-y-1/2 z-50 transition-all",
           position.x > window.innerWidth / 2 ? "right-0" : "left-0"
        )}
      >
        <Button
          data-resizer
          variant="secondary"
          className="h-24 w-8 p-0 rounded-l-none"
          onClick={handleUndock}
        >
          {position.x > window.innerWidth / 2 ? <ChevronsLeft className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn("fixed z-50")}
      ref={callUIRef}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <Card 
        className="w-full max-w-sm animate-in fade-in-0 shadow-2xl"
      >
         <CardHeader 
            data-movable
            className="text-center py-4 px-4 cursor-move flex-row items-center justify-between touch-none h-20" 
            onPointerDown={onDragStart}
         >
            <div className='flex items-center gap-2 flex-1 min-w-0'>
                {otherUser && (
                     <Link href={`/profile/${otherUser.uid}`} target="_blank">
                        <Avatar className="h-8 w-8 border-2 border-primary flex-shrink-0">
                             <AvatarImage src={otherUser.photoURL} alt={otherUser.screenName || 'User'} />
                            <AvatarFallback className="text-xs">
                                {getInitials(otherUser?.screenName)}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                )}
                <div className="text-left flex flex-col justify-center flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight truncate">
                        {otherUser ? `${otherUser.screenName}` : "Connecting..."}
                    </CardTitle>
                    <div className={cn("text-xs font-medium text-left flex items-center gap-1",
                        callStatus === 'connected' ? 'text-green-500' : 'text-muted-foreground',
                        callStatus === 'error' && 'text-destructive',
                        callStatus === 'reconnecting' && 'animate-pulse text-yellow-500'
                    )}>
                        {callStatus === 'reconnecting' && <AlertCircle className="h-3 w-3"/>}
                        {renderStatus()}
                    </div>
                </div>
            </div>
            <div className='flex items-center'>
                <Button variant="ghost" size="icon" className='w-7 h-7' onClick={() => setCallUIVisible(false)}>
                    <Minimize2 className='h-4 w-4'/>
                </Button>
            </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="relative">
                 {callStatus === 'connected' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-24 w-24 rounded-full border-2 border-green-500 animate-pulse"></div>
                    </div>
                )}
                 {callStatus === 'connecting' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-24 w-24 rounded-full border-4 border-primary animate-ping"></div>
                    </div>
                )}
                 <Avatar className="h-24 w-24 border-4 border-primary">
                    <AvatarImage src={otherUser?.photoURL} alt={otherUser?.screenName || 'User'} />
                    <AvatarFallback className="text-4xl">
                        {getInitials(otherUser?.screenName)}
                    </AvatarFallback>
                </Avatar>
            </div>

            {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
            )}
        
        </CardContent>
        <CardFooter className="flex justify-center space-x-2">
            <Button variant={isMuted ? 'destructive' : 'outline'} size="icon" className="h-12 w-12 rounded-full" onClick={toggleMute} disabled={callStatus !== 'connected'}>
                {isMuted ? <MicOff /> : <Mic />}
            </Button>
            <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={handleEndCallClick}>
                <PhoneOff />
            </Button>
            <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" disabled={!chatId}>
                        <MessageSquare />
                    </Button>
                </DialogTrigger>
                <DialogContent className="h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Chat with {otherUser?.screenName}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 px-6">
                        {messages.map((message) => {
                             if (message.senderId === 'system') {
                                const parts = message.text.split('|');
                                const mainText = parts[0];
                                const time = parts[1];
                                return (
                                    <div key={message.id} className="text-center text-xs text-muted-foreground my-4 space-y-1">
                                        <p>{mainText}</p>
                                        {time && <p className="text-muted-foreground/80">{time}</p>}
                                    </div>
                                )
                            }
                            
                            const isCurrentUser = message.senderId === identity;

                            return (
                                <div
                                    key={message.id}
                                    className={cn(
                                    'flex items-end gap-2 max-w-xs',
                                    isCurrentUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                                    )}
                                >
                                    <Avatar className="h-8 w-8">
                                    <AvatarImage src={isCurrentUser ? user?.photoURL || undefined : otherUser?.photoURL || undefined} />
                                    <AvatarFallback className="text-xs">
                                        {isCurrentUser ? getInitials(screenName) : getInitials(otherUser?.screenName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div
                                        className={cn(
                                            'rounded-lg px-3 py-2 text-sm',
                                            isCurrentUser
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                        )}
                                    >
                                        <p className="mb-1 break-all whitespace-pre-wrap">{message.text}</p>
                                        <p className={cn("text-xs text-right", isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground/70' )}>
                                            {message.timestamp ? format(new Date(message.timestamp), 'p') : ''}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t px-6 pb-6">
                        <div className="relative">
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type a message..."
                                className="pr-12"
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
                </DialogContent>
            </Dialog>
        </CardFooter>
      </Card>
      <audio ref={remoteAudioRef} playsInline autoPlay />
    </div>
  );
}
