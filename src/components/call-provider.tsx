
'use client';

import { useState, useCallback, type ReactNode, useRef, useEffect } from 'react';
import { CallContext, type CallStatus, type RejoinRequest } from '@/context/call-context';
import { database } from '@/lib/firebase';
import { ref, remove, onValue, set, get, push, update, serverTimestamp, off, query, orderByChild, equalTo, runTransaction, onDisconnect } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import isEqual from 'lodash/isEqual';
import { Button } from './ui/button';
import { Phone, Star } from 'lucide-react';
import { WaitingToastContent } from './waiting-toast';
import { format } from 'date-fns';
import { ReviewDialog } from './review-dialog';
import { getUidFromIdentity, getRoleFromIdentity } from '@/lib/chatUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
}

interface PendingRequest {
    id: string;
    memberId: string;
    topics: string[];
    details: string;
    communicationMethod: 'text' | 'call';
    createdAt: number;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'joined';
    acceptedAt?: number;
    listenerId?: string;
    callId?: string;
}

const WAITING_TIME = 60; // 60 seconds
const CALL_REVIEW_THRESHOLD_SECONDS = 4 * 60; // 4 minutes
const RECONNECT_TIMEOUT = 30000; // 30 seconds

const playReconnectSound = () => {
    if (typeof window === 'undefined') {
        return;
    }
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
        console.warn("Web Audio API is not supported on this browser.");
        return;
    }

    const audioContext = new AudioContext();

    // Function to create a single soft beep
    const createBeep = (startTime: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // A softer tone
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(300, startTime);

        // Much lower volume and a smooth fade-in/fade-out
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.05, startTime + 0.05); // Ramp up to a very low volume
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15); // Ramp down quickly

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.2);
    };

    // Create a sequence of beeps over ~2 seconds
    const now = audioContext.currentTime;
    createBeep(now);
    createBeep(now + 0.5);
    createBeep(now + 1.0);
    createBeep(now + 1.5);
    
    // Close the audio context after the sounds have finished playing
    setTimeout(() => {
        if (audioContext.state !== 'closed') {
            audioContext.close();
        }
    }, 2000); // Close after 2 seconds
};


export function CallProvider({ children }: { children: ReactNode }) {
  const { user, role, identity } = useAuth();
  const router = useRouter();
  const { toast, dismiss } = useToast();

  const [callId, setCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('disconnected');
  const [otherUser, setOtherUser] = useState<{ screenName: string | null; uid: string, role: string, identity: string, photoURL?: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [reconnectTimeLeft, setReconnectTimeLeft] = useState<number | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isCallUIVisible, setCallUIVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [acceptedListenerRequest, setAcceptedListenerRequest] = useState<PendingRequest | null>(null);
  
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewableListener, setReviewableListener] = useState<{uid: string, screenName: string} | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  
  const [rejoinRequest, setRejoinRequest] = useState<RejoinRequest | null>(null);
  const [rejoinTimeLeft, setRejoinTimeLeft] = useState<number | null>(null);


  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callEndedRef = useRef(false);
  const currentCallIdRef = useRef<string | null>(null);
  const callStatusRef = useRef<CallStatus>('disconnected');
  const earlyIceCandidates = useRef<RTCIceCandidate[]>([]);
  const firebaseListenersRef = useRef<{ ref: any; listener: any; event: 'value' }[]>([]);
  const hasCreatedAnswerRef = useRef(false);
  const hasSetRemoteAnswerRef = useRef(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rejoinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rejoinCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectingRef = useRef(false);
  const notifiedRequestId = useRef<string | null>(null);
  const waitingToastRef = useRef<{ id: string } | null>(null);
  const requestListenerRef = useRef<any>(null);
  const isRejoiningRef = useRef(false);
  const rejoinRequestRef = useRef<RejoinRequest | null>(null);
  rejoinRequestRef.current = rejoinRequest;


  useEffect(() => {
    currentCallIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  const cleanupToast = useCallback(() => {
    if (waitingToastRef.current) {
        dismiss(waitingToastRef.current.id);
        waitingToastRef.current = null;
    }
  },[dismiss]);


  const cleanupListeners = useCallback(() => {
    firebaseListenersRef.current.forEach(({ ref, listener, event }) => {
      if (ref && listener) {
        off(ref, event, listener);
      }
    });
    firebaseListenersRef.current = [];
  }, []);

  const resetState = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
    if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
    if (rejoinCountdownIntervalRef.current) clearInterval(rejoinCountdownIntervalRef.current);
    
    cleanupListeners();
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    cleanupToast();
    setCallId(null);
    currentCallIdRef.current = null;
    setCallStatus('disconnected');
    setOtherUser(null);
    setError(null);
    setDuration(0);
    setIsMuted(false);
    setChatId(null);
    setMessages([]);
    setEndReason(null);
    setReconnectTimeLeft(null);
    reconnectingRef.current = false;
    callEndedRef.current = false;
    hasCreatedAnswerRef.current = false;
    hasSetRemoteAnswerRef.current = false;
    earlyIceCandidates.current = [];
    setCallUIVisible(false);
    setRejoinRequest(null);
    setRejoinTimeLeft(null);
    isRejoiningRef.current = false;
  }, [localStream, cleanupListeners, cleanupToast]);
  
  const handleReviewEligibility = useCallback(async (callDuration: number, listenerId?: string, listenerScreenName?: string) => {
      if (role !== 'member' || !listenerId || callDuration < CALL_REVIEW_THRESHOLD_SECONDS) {
          return;
      }
      
      const reviewsRef = ref(database, `reviews/${listenerId}`);
      const existingReviewQuery = query(reviewsRef, orderByChild('memberId'), equalTo(user!.uid));
      const reviewSnapshot = await get(existingReviewQuery);
      if (reviewSnapshot.exists()) {
          setHasAlreadyReviewed(true);
          return;
      }
      
      setReviewableListener({uid: listenerId, screenName: listenerScreenName || 'the listener'});

      toast({
          title: "How was your call?",
          description: `You can now leave a review for ${listenerScreenName || 'the listener'}.`,
          duration: 10000,
          action: (
            <Button onClick={() => setIsReviewDialogOpen(true)}>
                <Star className="mr-2 h-4 w-4" />
                Leave Review
            </Button>
          )
      })

  }, [role, user, toast]);

  const endCall = useCallback((isInitiator = false, reason: string = 'manual') => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    
    setEndReason(reason);
    setCallStatus('disconnected');
    if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
    if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
    
    const finalDuration = duration;
    const listenerInfo = role === 'member' ? otherUser : null;
    const finalCallId = currentCallIdRef.current;

    if (chatId && finalDuration > 0) {
        const endTime = format(new Date(), 'p');
        const messageText = `Call ended. Duration: ${Math.floor(finalDuration / 60).toString().padStart(2, '0')}:${(finalDuration % 60).toString().padStart(2, '0')}|${endTime}`;
        const messagesRef = ref(database, `chats/${chatId}/messages`);
        const messageData = {
          text: messageText,
          senderId: 'system',
          timestamp: serverTimestamp(),
        };
        push(messagesRef, messageData);
    }
    
    if (isInitiator && finalCallId) {
      const callRef = ref(database, `calls/${finalCallId}`);
      remove(callRef);
    }
    
    handleReviewEligibility(finalDuration, listenerInfo?.uid, listenerInfo?.screenName || undefined);
    
    setTimeout(() => {
        resetState();
    }, 3000);
  }, [duration, resetState, role, otherUser, handleReviewEligibility, chatId]);
  
  const setupIceCandidateListeners = useCallback((newCallId: string, isCaller: boolean) => {
    const pc = pcRef.current;
    if (!pc) return;

    const localCandidatesCollection = isCaller ? 'callerCandidates' : 'calleeCandidates';
    const remoteCandidatesCollection = isCaller ? 'calleeCandidates' : 'callerCandidates';

    const localCandidatesRef = ref(database, `calls/${newCallId}/${localCandidatesCollection}`);
    const remoteCandidatesRef = ref(database, `calls/${newCallId}/${remoteCandidatesCollection}`);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
          push(localCandidatesRef, event.candidate.toJSON());
        }
    };

    pc.oniceconnectionstatechange = () => {
      if (!pc) return;
      
      switch (pc.iceConnectionState) {
        case 'connected':
        case 'completed':
          if (reconnectingRef.current) {
            toast({ title: 'Reconnected!' });
            update(ref(database, `calls/${newCallId}`), { reconnectExpiresAt: null });
          }
          if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
          if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
          setReconnectTimeLeft(null);
          reconnectingRef.current = false;
          setCallStatus('connected');
          break;
        case 'failed':
        case 'closed':
          if (!callEndedRef.current) endCall(isCaller, 'failed');
          break;
        case 'disconnected':
             if (!reconnectingRef.current && callStatusRef.current === 'connected') {
                reconnectingRef.current = true;
                setCallStatus('reconnecting');
                
                setReconnectTimeLeft(RECONNECT_TIMEOUT / 1000);

                if(reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
                reconnectCountdownIntervalRef.current = setInterval(() => {
                    setReconnectTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
                }, 1000);
                
                if(reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
                reconnectionTimerRef.current = setTimeout(() => {
                    if (!callEndedRef.current) endCall(true, 'timeout');
                }, RECONNECT_TIMEOUT);
            }
            break;
        default:
          break;
      }
    }

    const remoteIceListener = onValue(remoteCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const candidate = new RTCIceCandidate(childSnapshot.val());
            if (pc.signalingState !== 'closed') {
              if (pc.remoteDescription) {
                 pc.addIceCandidate(candidate).catch(e => console.error("Error adding received ice candidate", e));
              } else {
                 earlyIceCandidates.current.push(candidate);
              }
            }
        });
    });
    
    firebaseListenersRef.current.push({ ref: remoteCandidatesRef, listener: remoteIceListener, event: 'value' });
  }, [endCall, toast]);

  const setupChat = useCallback(async (currentUserIdentity: string, otherUserIdentity: string) => {
    const newChatId = [currentUserIdentity, otherUserIdentity].sort().join('__');
    setChatId(newChatId);

    const chatRef = ref(database, `chats/${newChatId}`);
    const chatSnapshot = await get(chatRef);
    if (!chatSnapshot.exists()) {
        const currentUserRole = getRoleFromIdentity(currentUserIdentity);
        const otherUserRole = getRoleFromIdentity(otherUserIdentity);
        const systemType = [currentUserRole, otherUserRole].sort().join('-') as 'listener-member' | 'member-member' | 'listener-listener';
        
        const updates: {[key: string]: any} = {};
        updates[`/chats/${newChatId}`] = {
            participants: { [currentUserIdentity]: true, [otherUserIdentity]: true },
            systemType,
            createdAt: serverTimestamp(),
            lastMessageTimestamp: serverTimestamp(),
        };
        updates[`/user_chats/${currentUserIdentity}/${newChatId}`] = serverTimestamp();
        updates[`/user_chats/${otherUserIdentity}/${newChatId}`] = serverTimestamp();
        await update(ref(database), updates);
    }

    const messagesRef = ref(database, `chats/${newChatId}/messages`);
    const messagesListener = onValue(messagesRef, (snapshot) => {
        const messagesData = snapshot.val();
        const loadedMessages: Message[] = [];
        if (messagesData) {
            Object.keys(messagesData).forEach(key => {
                loadedMessages.push({ id: key, ...messagesData[key] });
            });
            loadedMessages.sort((a, b) => a.timestamp - b.timestamp);
            setMessages(loadedMessages);
        } else {
            setMessages([]);
        }
    });
     firebaseListenersRef.current.push({ ref: messagesRef, listener: messagesListener, event: 'value' });
  }, []);

  const _startCallProcess = useCallback(async (newCallId: string, currentUserIdentity: string, isCaller: boolean, isRejoin: boolean) => {
    
    if (!isRejoin) {
        resetState();
    } else {
        // Partial reset for rejoins: clean up listeners and timers, but preserve streams and state
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
        if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
        cleanupListeners();
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
    }

    callEndedRef.current = false;
    setCallId(newCallId);
    currentCallIdRef.current = newCallId;
    setCallStatus('initializing');
    setCallUIVisible(true);

    const servers = {
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
    };
    
    let stream: MediaStream;
    try {
        if (localStream) {
            stream = localStream;
        } else {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            setLocalStream(stream);
        }
        setCallStatus('permission-granted');
    } catch (err) {
        console.error('Error accessing microphone:', err);
        setError('Microphone access is required. Please enable it and refresh.');
        setCallStatus('error');
        return;
    }

    const participantRef = ref(database, `calls/${newCallId}/participants/${currentUserIdentity}`);
    await set(participantRef, { status: 'online' });
    onDisconnect(participantRef).set({ status: 'offline' });

    const userCallRef = ref(database, `user_calls/${currentUserIdentity}/${newCallId}`);
    if(!isRejoin) {
        await set(userCallRef, serverTimestamp());
    }

    pcRef.current = new RTCPeerConnection(servers);
    stream.getTracks().forEach(track => pcRef.current?.addTrack(track, stream));

    pcRef.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
    };

    const callRef = ref(database, `calls/${newCallId}`);
    const callListener = onValue(callRef, async (snapshot) => {
        if (currentCallIdRef.current !== newCallId) return;

        if (!snapshot.exists()) {
           if (!callEndedRef.current) {
                const reason = reconnectingRef.current ? 'timeout' : 'hangup';
                endCall(false, reason);
           }
           return;
        }

        const callData = snapshot.val();
        const participants = callData.participants || {};
        const otherUserIdentity = Object.keys(participants).find(id => id !== currentUserIdentity);

        if (otherUserIdentity) {
            if (!otherUser) {
                const otherUserId = getUidFromIdentity(otherUserIdentity);
                const otherUserRole = getRoleFromIdentity(otherUserIdentity);
                const userSnapshot = await get(ref(database, `users/${otherUserId}`));
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    const otherUserRoleData = userData.roles?.[otherUserRole] || {};
                    setOtherUser({
                        screenName: otherUserRoleData.screenName || 'Anonymous',
                        uid: otherUserId,
                        role: otherUserRole,
                        identity: otherUserIdentity,
                        photoURL: otherUserRoleData.photoURL,
                    });
                    await setupChat(currentUserIdentity, otherUserIdentity);
                }
            }

            const otherParticipantData = participants[otherUserIdentity];
            if (otherParticipantData.status === 'offline' && callStatusRef.current === 'connected') {
                if (!reconnectingRef.current) {
                    reconnectingRef.current = true;
                    setCallStatus('reconnecting');
                    
                    const expiresAt = Date.now() + RECONNECT_TIMEOUT;
                    update(ref(database, `calls/${newCallId}`), { reconnectExpiresAt: expiresAt });
                    
                    setReconnectTimeLeft(RECONNECT_TIMEOUT / 1000);

                    if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
                    reconnectCountdownIntervalRef.current = setInterval(() => {
                        setReconnectTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
                    }, 1000);

                    if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
                    reconnectionTimerRef.current = setTimeout(() => {
                        if (!callEndedRef.current) endCall(true, 'timeout');
                    }, RECONNECT_TIMEOUT);
                }
            } else if (otherParticipantData.status === 'online' && callStatusRef.current === 'reconnecting') {
                reconnectingRef.current = false;
                if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
                if (reconnectCountdownIntervalRef.current) clearInterval(reconnectCountdownIntervalRef.current);
                setCallStatus('connected');
                setReconnectTimeLeft(null);
                toast({ title: 'User reconnected!' });
                update(ref(database, `calls/${newCallId}`), { reconnectExpiresAt: null });
            }
        }
        
        if (callData.offer && !isCaller && !hasCreatedAnswerRef.current && pcRef.current && pcRef.current.signalingState !== 'closed') {
            hasCreatedAnswerRef.current = true;
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
            
            earlyIceCandidates.current.forEach(candidate => pcRef.current?.addIceCandidate(candidate));
            earlyIceCandidates.current = [];

            const answerDescription = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answerDescription);
            await update(callRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });
        }

        if (callData.answer && isCaller && !hasSetRemoteAnswerRef.current && pcRef.current?.signalingState === 'have-local-offer') {
            hasSetRemoteAnswerRef.current = true;
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(callData.answer));
            earlyIceCandidates.current.forEach(candidate => pcRef.current?.addIceCandidate(candidate));
            earlyIceCandidates.current = [];
        }
    });
    firebaseListenersRef.current.push({ ref: callRef, listener: callListener, event: 'value' });
    
    setupIceCandidateListeners(newCallId, isCaller);

    if (isCaller) {
        if (!pcRef.current) return;
        setCallStatus('connecting');
        const offerDescription = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offerDescription);
        const updates: { [key: string]: any } = { offer: { type: offerDescription.type, sdp: offerDescription.sdp } };
        await update(callRef, updates);
    }
  }, [resetState, setupChat, endCall, otherUser, setupIceCandidateListeners, toast, localStream, cleanupListeners]);

  const initiateCall = useCallback(async (newCallId: string, currentUserId: string, isCaller: boolean) => {
     if (callId) return; // Already in a call
     await _startCallProcess(newCallId, `${currentUserId}_${role}`, isCaller, false);
  }, [callId, _startCallProcess, role]);

  const handleDeclineRejoin = useCallback(async () => {
    if (isRejoiningRef.current) {
        return;
    }
    
    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
    if (rejoinCountdownIntervalRef.current) clearInterval(rejoinCountdownIntervalRef.current);
    setRejoinTimeLeft(null);

    const requestToDecline = rejoinRequestRef.current;
    setRejoinRequest(null);

    if (!requestToDecline || !identity) {
      return;
    }
    
    const { callId: callIdToDecline } = requestToDecline;

    const callRef = ref(database, `calls/${callIdToDecline}`);
    remove(callRef);
    
    const userCallRef = ref(database, `user_calls/${identity}/${callIdToDecline}`);
    remove(userCallRef);

  }, [identity]);

  const handleConfirmRejoin = useCallback(async () => {
    isRejoiningRef.current = true;
    if (!rejoinRequest || !identity) return;

    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
    if (rejoinCountdownIntervalRef.current) clearInterval(rejoinCountdownIntervalRef.current);
    setRejoinTimeLeft(null);

    const { callId, isCaller } = rejoinRequest;
    setRejoinRequest(null);
    await _startCallProcess(callId, identity, isCaller, true);
  }, [rejoinRequest, identity, _startCallProcess]);

  useEffect(() => {
    if (!user || !identity || callId) return;

    const checkRejoin = async () => {
        const userCallsRef = ref(database, `user_calls/${identity}`);
        const snapshot = await get(userCallsRef);
        if (!snapshot.exists()) return;

        for (const callId of Object.keys(snapshot.val())) {
            const callRef = ref(database, `calls/${callId}`);
            const callSnapshot = await get(callRef);
            if (callSnapshot.exists()) {
                 const callData = callSnapshot.val();
                 if (!callData.participants) continue;
                 const myStatus = callData.participants[identity]?.status;
                 const otherIdentity = Object.keys(callData.participants).find(p => p !== identity);
                 const otherStatus = otherIdentity ? callData.participants[otherIdentity]?.status : 'offline';
                 
                 if (otherStatus === 'online' && myStatus !== 'online') {
                    const expiresAt = callData.reconnectExpiresAt;
                    let initialRejoinTime = RECONNECT_TIMEOUT / 1000;

                    if (expiresAt) {
                        const timeLeftMs = expiresAt - Date.now();
                        if (timeLeftMs > 0) {
                            initialRejoinTime = Math.round(timeLeftMs / 1000);
                        } else {
                            continue;
                        }
                    }

                    setRejoinRequest({ callId, isCaller: callData.callerId === user.uid });
                    setRejoinTimeLeft(initialRejoinTime);

                    if (rejoinCountdownIntervalRef.current) clearInterval(rejoinCountdownIntervalRef.current);
                    rejoinCountdownIntervalRef.current = setInterval(() => {
                        setRejoinTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
                    }, 1000);

                    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
                    rejoinTimerRef.current = setTimeout(() => {
                        handleDeclineRejoin();
                    }, initialRejoinTime * 1000);

                    return;
                 }
            }
        }
    };
    checkRejoin();
  }, [user, identity, callId, handleDeclineRejoin]);


  useEffect(() => {
    if (callStatus === 'connected') {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
            setDuration(prevDuration => prevDuration + 1);
        }, 1000);
    } else {
       if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
       }
    }
    
    return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [callStatus]);

  useEffect(() => {
    if (!user || role !== 'member') {
      if (requestListenerRef.current) {
        off(requestListenerRef.current.ref, 'value', requestListenerRef.current.listener);
        requestListenerRef.current = null;
      }
      setPendingRequest(null); 
      return;
    }
  
    const requestQuery = query(ref(database, 'requests'), orderByChild('memberId'), equalTo(user.uid));
  
    const listener = onValue(requestQuery, (snapshot) => {
      let activeRequest: PendingRequest | null = null;
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const requestData = childSnapshot.val();
          if (['pending', 'accepted'].includes(requestData.status)) {
            activeRequest = { id: childSnapshot.key!, ...requestData };
          }
        });
      }
      
      if (!isEqual(pendingRequest, activeRequest)) {
        setPendingRequest(activeRequest);
      }
    });
  
    requestListenerRef.current = { ref: requestQuery, listener };
  
    return () => {
      off(requestQuery, 'value', listener);
      requestListenerRef.current = null;
    };
  }, [user, role, pendingRequest]); 
  
  
  useEffect(() => {
    if (!user || role !== 'listener') {
      if (acceptedListenerRequest) setAcceptedListenerRequest(null);
      return;
    }
    
    const requestQuery = query(ref(database, 'requests'), orderByChild('status'), equalTo('accepted'));

    const listener = onValue(requestQuery, (snapshot) => {
        let acceptedCallRequest: PendingRequest | null = null;
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const req = childSnapshot.val();
                if (req.listenerId === user.uid && req.communicationMethod === 'call') {
                    acceptedCallRequest = { id: childSnapshot.key!, ...req };
                }
            });
        }
        setAcceptedListenerRequest(acceptedCallRequest);
    });

    const listenerRef = { ref: requestQuery, listener, event: 'value' as const};
    firebaseListenersRef.current.push(listenerRef);
    
    return () => {
        off(listenerRef.ref, listenerRef.event, listenerRef.listener);
        firebaseListenersRef.current = firebaseListenersRef.current.filter(l => l !== listenerRef);
    };
  }, [user, role]);


  useEffect(() => {
    if (role !== 'listener') {
        return;
    }
    if (acceptedListenerRequest?.status === 'accepted' && acceptedListenerRequest.communicationMethod === 'call') {
      const request = acceptedListenerRequest;
      const toastId = `waiting-toast-${request.id}`;

      if (waitingToastRef.current?.id === toastId) {
        return;
      }
      
      cleanupToast();

      const { id } = toast({
          id: toastId,
          title: "Waiting for Member",
          description: <WaitingToastContent acceptedAt={request.acceptedAt!} onCancel={async () => {
              await update(ref(database, `requests/${request.id}`), { status: 'cancelled' });
          }} />,
          dismissible: false,
          duration: WAITING_TIME * 1000 + 5000,
      });
      waitingToastRef.current = { id };

      const requestRef = ref(database, `requests/${request.id}`);
      const joinListener = onValue(requestRef, (snapshot) => {
        const updatedRequest = snapshot.val();
        if (updatedRequest?.status === 'joined' && updatedRequest.callId && user) {
            cleanupToast();
            initiateCall(updatedRequest.callId, user.uid, true);
        } else if (!snapshot.exists() || !['accepted', 'joined'].includes(updatedRequest?.status)) {
            cleanupToast();
        }
      });

      const listenerRef = { ref: requestRef, listener: joinListener, event: 'value' as const};
      firebaseListenersRef.current.push(listenerRef);

    } else {
        cleanupToast();
    }
  }, [acceptedListenerRequest, user, role, cleanupToast, toast, initiateCall]);


  const sendMessage = useCallback((text: string) => {
     if (!chatId || !identity || !otherUser?.identity) return;

     const messagesRef = ref(database, `chats/${chatId}/messages`);
     push(messagesRef, { text, senderId: identity, timestamp: serverTimestamp() });
     
     update(ref(database, `chats/${chatId}`), { 
         lastMessage: text,
         lastMessageTimestamp: serverTimestamp(),
      });
     
     const otherUserUnreadRef = ref(database, `chats/${chatId}/unread/${otherUser.identity}`);
     runTransaction(otherUserUnreadRef, (count) => (count || 0) + 1);
  }, [chatId, identity, otherUser]);

  useEffect(() => {
    const handleAcceptedRequest = async () => {
        if (!pendingRequest || pendingRequest.status !== 'accepted' || !pendingRequest.listenerId || !user) {
            return;
        }

        if (notifiedRequestId.current === pendingRequest.id) return;
        notifiedRequestId.current = pendingRequest.id;

        const requestRef = ref(database, `requests/${pendingRequest.id}`);
        const listenerId = pendingRequest.listenerId;
        const acceptedAt = pendingRequest.acceptedAt || Date.now();

        if (pendingRequest.communicationMethod === 'text') {
            await update(requestRef, { status: 'completed' });
            const memberIdentity = `${user.uid}_member`;
            const listenerIdentity = `${listenerId}_listener`;
            const chatId = [memberIdentity, listenerIdentity].sort().join('__');
            const { id: toastId } = toast({
                title: 'Listener Found!',
                description: 'A listener has accepted your request to chat.',
                action: (
                    <Button onClick={() => {
                        router.push(`/chat/${chatId}`);
                        dismiss(toastId);
                    }}>Go to Chat</Button>
                ),
                duration: Infinity,
            });
        } else if (pendingRequest.communicationMethod === 'call') {
            const { id: toastId } = toast({
                title: 'Listener Ready!',
                description: (
                    <WaitingToastContent
                        acceptedAt={acceptedAt}
                        onCancel={async () => {
                           await update(requestRef, { status: 'cancelled' });
                           dismiss(toastId);
                        }}
                        actionButton={(
                            <Button onClick={async () => {
                                dismiss(toastId);
                                const callRef = push(ref(database, 'calls'));
                                const newCallId = callRef.key!;
                                
                                await set(callRef, {
                                    callerId: listenerId, 
                                    calleeId: user.uid,
                                    status: 'pending',
                                    createdAt: serverTimestamp(),
                                    participants: {}
                                });
            
                                await update(requestRef, {
                                    status: 'joined',
                                    callId: newCallId
                                });
                                initiateCall(newCallId, user.uid, false);
                            }}>
                                <Phone className="mr-2 h-4 w-4" />
                                Join Call
                            </Button>
                        )}
                    />
                ),
                duration: WAITING_TIME * 1000 + 5000,
                dismissible: false,
            });
        }
    };
    
    handleAcceptedRequest();

  }, [pendingRequest, user, router, toast, dismiss, initiateCall]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
          track.enabled = !track.enabled;
          setIsMuted(!track.enabled);
      });
    }
  }, [localStream]);
  
  const handleReviewSubmit = async (rating: number, reviewText: string) => {
    if (!user || !reviewableListener) return;
    
    if (hasAlreadyReviewed) {
        toast({ variant: 'destructive', title: 'Already Reviewed', description: 'You have already submitted a review for this listener.' });
        setIsReviewDialogOpen(false);
        return;
    }
    
    const reviewsRef = ref(database, `reviews/${reviewableListener.uid}`);
    const reviewRef = push(reviewsRef);
    await set(reviewRef, {
      rating,
      text: reviewText,
      memberId: user.uid,
      createdAt: serverTimestamp()
    });

    const listenerRef = ref(database, `users/${reviewableListener.uid}`);
    runTransaction(listenerRef, (listener) => {
      if (listener && listener.roles?.listener) {
        const currentReviewCount = listener.roles.listener.reviewCount || 0;
        const currentTotalRating = listener.roles.listener.totalRating || 0;
        
        const newReviewCount = currentReviewCount + 1;
        const newTotalRating = currentTotalRating + rating;
        
        listener.roles.listener.reviewCount = newReviewCount;
        listener.roles.listener.totalRating = newTotalRating;
        listener.roles.listener.rating = newTotalRating / newReviewCount;
      }
      return listener;
    });

    toast({ title: 'Review Submitted!', description: 'Thank you for your feedback.' });
    setIsReviewDialogOpen(false);
    setReviewableListener(null);
  };
  
  const value = {
    callId,
    setCallId,
    callStatus,
    setCallStatus,
    otherUser,
    setOtherUser,
    isMuted,
    setIsMuted,
    toggleMute,
    error,
    setError,
    duration,
    setDuration,
    endCall,
    localStream,
    setLocalStream,
    remoteStream,
    initiateCall,
    messages,
    chatId,
    sendMessage,
    isCallUIVisible,
    setCallUIVisible,
    resetState,
    pendingRequest,
    setPendingRequest,
    reconnectTimeLeft,
    endReason,
    rejoinRequest,
    rejoinTimeLeft,
    handleConfirmRejoin,
    handleDeclineRejoin,
  };

  return (
    <CallContext.Provider value={value}>
        {children}
        {reviewableListener && (
            <ReviewDialog
              open={isReviewDialogOpen}
              onOpenChange={setIsReviewDialogOpen}
              listenerName={reviewableListener.screenName}
              onSubmit={handleReviewSubmit}
            />
        )}
    </CallContext.Provider>
  );
}
