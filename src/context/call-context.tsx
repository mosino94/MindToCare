
'use client';

import { createContext, Dispatch, SetStateAction } from 'react';

export type CallStatus = 'initializing' | 'permission-granted' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

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

export interface RejoinRequest {
  callId: string;
  isCaller: boolean;
}

export interface CallContextType {
    callId: string | null;
    callStatus: CallStatus;
    isMuted: boolean;
    otherUser: { screenName: string | null; uid: string, role: string, identity: string, photoURL?: string } | null;
    error: string | null;
    duration: number;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    messages: Message[];
    chatId: string | null;
    isCallUIVisible: boolean;
    pendingRequest: PendingRequest | null;
    reconnectTimeLeft: number | null;
    endReason: string | null;
    rejoinRequest: RejoinRequest | null;
    rejoinTimeLeft: number | null;

    setDuration: (duration: number) => void;
    toggleMute: () => void;
    endCall: (isInitiator?: boolean, reason?: string) => void;
    setCallId: (id: string | null) => void;
    setCallStatus: (status: CallStatus) => void;
    setOtherUser: (user: { screenName: string | null; uid: string, role: string, identity: string, photoURL?: string } | null) => void;
    setError: (error: string | null) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setIsMuted: (muted: boolean) => void;
    initiateCall: (callId: string, currentUserId: string, isCaller: boolean) => void;
    sendMessage: (text: string) => void;
    setCallUIVisible: (visible: boolean) => void;
    resetState: () => void;
    setPendingRequest: Dispatch<SetStateAction<PendingRequest | null>>;
    handleConfirmRejoin: () => void;
    handleDeclineRejoin: () => void;
}

export const CallContext = createContext<CallContextType | undefined>(undefined);
