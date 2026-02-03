
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useContext, useState, useCallback, useEffect } from 'react';
import { MemberPageContext } from '@/context/member-page-context';
import { Pencil, Phone, MessageCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import { database } from '@/lib/firebase';
import { ref, push, set, serverTimestamp, update, get } from 'firebase/database';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TopicSelector } from '@/components/topic-selector';
import { useToast } from '@/hooks/use-toast';
import { MENTAL_HEALTH_TOPICS } from '@/lib/topics';
import { useCall } from '@/hooks/use-call';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export function FindListenerDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const memberContext = useContext(MemberPageContext);
  const { pendingRequest, setPendingRequest } = useCall();

  const isRequestDialogOpen = memberContext?.isRequestDialogOpen ?? false;
  const setIsRequestDialogOpen = memberContext?.setIsRequestDialogOpen ?? (() => {});

  const [isFormVisible, setIsFormVisible] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [communicationMethod, setCommunicationMethod] = useState<'text' | 'call' | null>(null);
  const [details, setDetails] = useState('');

  const resetForm = useCallback(() => {
    setSelectedTopics([]);
    setDetails('');
    setCommunicationMethod(null);
  }, []);

  const handleFindListener = async () => {
    if (!user || !communicationMethod || selectedTopics.length === 0) return;

    setIsRequestDialogOpen(false);

    const memberScreenNameRef = ref(database, `users/${user.uid}/roles/member/screenName`);
    const memberScreenNameSnapshot = await get(memberScreenNameRef);
    const memberScreenName = memberScreenNameSnapshot.val();

    if (!memberScreenName) {
      toast({
        variant: "destructive",
        title: "Profile Incomplete",
        description: "Your screen name could not be found. Please complete your profile again.",
      });
      router.push('/profile');
      return;
    }

    const requestData = {
      memberId: user.uid,
      memberName: memberScreenName,
      memberEmail: user.email,
      topics: selectedTopics,
      details: details,
      communicationMethod,
      status: 'pending' as const,
      createdAt: serverTimestamp(),
    };

    if (pendingRequest?.id) {
      const requestRef = ref(database, `requests/${pendingRequest.id}`);
      await update(requestRef, requestData);
      setPendingRequest({ ...pendingRequest, ...requestData, createdAt: Date.now() });
    } else {
      const newRequestRef = push(ref(database, 'requests'));
      await set(newRequestRef, requestData);
    }
    resetForm();
  };

  const handleEditRequest = () => {
    if (!pendingRequest) return;
    // Pre-fill form for editing
    setSelectedTopics(pendingRequest.topics);
    setDetails(pendingRequest.details);
    setCommunicationMethod(pendingRequest.communicationMethod);
    // Switch to the form view
    setIsFormVisible(true);
  };
  
  const handleCancelRequest = async () => {
    if (!pendingRequest) return;
    const requestId = pendingRequest.id;
    setPendingRequest(null);
    setIsRequestDialogOpen(false); 
    
    const requestRef = ref(database, `requests/${requestId}`);
    const snapshot = await get(requestRef);
    if(snapshot.exists() && snapshot.val().status === 'pending') {
      await update(requestRef, { status: 'cancelled' });
    }
  };
  
  const handleDialogChange = (open: boolean) => {
    setIsRequestDialogOpen(open);
    if (!open) {
      // When dialog closes, if there wasn't a pending request, reset the form.
      if (!pendingRequest) {
        resetForm();
      }
    }
  };

  useEffect(() => {
    if (isRequestDialogOpen) {
      if (pendingRequest?.status === 'pending') {
        setIsFormVisible(false);
      } else {
        setIsFormVisible(true);
        resetForm(); 
      }
    }
  }, [pendingRequest, isRequestDialogOpen, resetForm]);

  return (
    <Dialog open={isRequestDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-[480px]">
          {!isFormVisible && pendingRequest ? (
             <>
              <DialogHeader>
                  <DialogTitle className="flex items-center justify-center gap-3 text-2xl font-headline">
                    Searching for a Listener
                  </DialogTitle>
                  <DialogDescription>We've sent your request. We'll connect you as soon as someone is available.</DialogDescription>
              </DialogHeader>
              <div className="text-left space-y-4 py-4">
                  <div className="space-y-1">
                      <h4 className="font-medium text-sm">Communication Method</h4>
                      <p className="text-muted-foreground capitalize">{pendingRequest.communicationMethod}</p>
                  </div>
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm">Topics</h4>
                      <p className="text-muted-foreground">{pendingRequest.topics.join(', ')}</p>
                  </div>
                  {pendingRequest.details && (
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm">Details</h4>
                          <p className="text-muted-foreground">{pendingRequest.details}</p>
                      </div>
                  )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleEditRequest} className="w-full sm:w-auto">
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button variant="destructive" onClick={handleCancelRequest} className="w-full sm:w-auto">
                      <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-headline">Find Support</DialogTitle>
                <DialogDescription>
                  Let us know what's on your mind so we can connect you with the right person.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="topics">What's on your mind? <span className="text-muted-foreground">(Select up to 3)</span></Label>
                  <TopicSelector 
                      topics={MENTAL_HEALTH_TOPICS} 
                      selectedTopics={selectedTopics} 
                      onChange={setSelectedTopics} 
                      maxSelection={3}
                    />
                </div>
                <div className="grid gap-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="details">Care to share more? <span className="text-muted-foreground">(Optional)</span></Label>
                        <span className="text-xs text-muted-foreground">{details.length}/100</span>
                    </div>
                  <Textarea 
                    id="details" 
                    placeholder="Tell us a little more about what you're going through..."
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={100}
                  />
                </div>
                  <div className="grid gap-2">
                  <Label>How would you like to communicate?</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setCommunicationMethod('text')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-colors",
                        communicationMethod === 'text'
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <MessageCircle className="h-8 w-8" />
                      <span className="font-medium">Text</span>
                    </button>
                    <button
                      onClick={() => setCommunicationMethod('call')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-colors",
                        communicationMethod === 'call'
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <Phone className="h-8 w-8" />
                      <span className="font-medium">Call</span>
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                <Button 
                  type="submit" 
                  onClick={handleFindListener} 
                  disabled={!communicationMethod || selectedTopics.length === 0}
                >
                  {pendingRequest ? 'Update Request' : 'Find Listener'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
  );
}
