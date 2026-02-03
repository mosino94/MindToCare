

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { database } from '@/lib/firebase';
import { ref, get, set, serverTimestamp, onValue, off, update } from 'firebase/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Languages, Globe, Smile, MessageCircle, Star, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { countries } from '@/lib/countries';
import { countryCodeToEmoji } from '@/lib/country-code-to-emoji';
import { getStatusColor } from '@/lib/chatUtils';

interface Review {
    id: string;
    rating: number;
    text: string;
    memberId: string;
    createdAt: number;
    memberScreenName?: string;
}

type RealtimeStatus = 'online' | 'busy' | 'offline';

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const { user: currentUser, identity: currentUserIdentity } = useAuth();
  const router = useRouter();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [userStatus, setUserStatus] = useState<RealtimeStatus>('offline');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    const userRef = ref(database, `users/${userId}`);
    let statusUnsubscribe: () => void = () => {};
    
    get(userRef).then(async (userSnapshot) => {
        if (userSnapshot.exists()) {
          const profileData = userSnapshot.val();
          
          const listenerProfile = profileData.roles?.listener;
          const memberProfile = profileData.roles?.member;
          const sharedProfile = profileData.sharedProfile || {};
          
          let displayProfile;
          let displayRole = 'member';

          // Prioritize showing the Listener profile if it's complete
          if (listenerProfile?.profileCompleted) {
              displayProfile = { ...sharedProfile, ...listenerProfile };
              displayRole = 'listener';
          } else {
              displayProfile = { ...sharedProfile, ...memberProfile };
          }
          
          displayProfile.role = displayRole;
          displayProfile.rating = listenerProfile?.rating;
          displayProfile.reviewCount = listenerProfile?.reviewCount;


          setUserProfile(displayProfile);

          const identity = `${userId}_${displayRole}`;
          const statusRef = ref(database, `status/${identity}`);
          statusUnsubscribe = onValue(statusRef, (snapshot) => {
              setUserStatus(snapshot.val()?.state || 'offline');
          });
          
          if (displayRole === 'listener') {
            const reviewsRef = ref(database, `reviews/${userId}`);
            const reviewsSnapshot = await get(reviewsRef);
            if (reviewsSnapshot.exists()) {
              const reviewsData = reviewsSnapshot.val();
              const reviewPromises = Object.keys(reviewsData).map(async (key) => {
                const review = { id: key, ...reviewsData[key] };
                const memberRef = ref(database, `users/${review.memberId}`);
                const memberSnapshot = await get(memberRef);
                if (memberSnapshot.exists()) {
                  const memberData = memberSnapshot.val();
                  review.memberScreenName = memberData.roles?.member?.screenName || 'Anonymous';
                } else {
                  review.memberScreenName = 'Anonymous';
                }
                return review;
              });

              const loadedReviews = await Promise.all(reviewPromises);
              setReviews(loadedReviews.sort((a, b) => b.createdAt - a.createdAt));
            }
          }
        }
      })
      .catch((error) => {
        console.error("Failed to fetch profile or reviews:", error);
      })
      .finally(() => {
        setLoading(false);
      });
      
    return () => {
        statusUnsubscribe();
    };

  }, [userId]);
  
  const handleMessage = async () => {
    if (!currentUser || !currentUserIdentity || !userProfile) return;

    const otherUserRole = userProfile.role;
    const otherUserIdentity = `${userId}_${otherUserRole}`;
    
    if (currentUserIdentity === otherUserIdentity) return; // Can't chat with self

    const chatId = [currentUserIdentity, otherUserIdentity].sort().join('__');
    const chatRef = ref(database, `chats/${chatId}`);
    
    const chatSnapshot = await get(chatRef);
    if (!chatSnapshot.exists()) {
      const currentUserRole = currentUserIdentity.split('_')[1];
      const roles = [currentUserRole, otherUserRole].sort();
      const systemType = roles.join('-') as 'listener-member' | 'member-member' | 'listener-listener';
      
      const timestamp = serverTimestamp();
      const updates: { [key: string]: any } = {};

      updates[`/chats/${chatId}`] = {
        participants: {
          [currentUserIdentity]: true,
          [otherUserIdentity]: true,
        },
        systemType,
        lastMessageTimestamp: timestamp,
        createdAt: timestamp,
      };

      updates[`/user_chats/${currentUserIdentity}/${chatId}`] = timestamp;
      updates[`/user_chats/${otherUserIdentity}/${chatId}`] = timestamp;
      
      await update(ref(database), updates);
    }
    
    router.push(`/chat/${chatId}`);
  };
  
  const renderStars = (rating: number) => {
    const totalStars = 5;
    const fullStars = Math.floor(rating);
    const emptyStars = totalStars - fullStars;
    
    return (
        <div className="flex items-center gap-1 text-amber-500">
            {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className="h-5 w-5 fill-current"/>)}
            {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className="h-5 w-5"/>)}
            <span className="text-muted-foreground text-sm ml-1">({rating.toFixed(1)})</span>
        </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-2xl">
        <Card>
          <CardHeader className="items-center text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2 mt-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <h1 className="text-2xl font-bold">User not found</h1>
      </div>
    );
  }
  
  const { screenName, bio, photoURL, country, languages = [], livedExperience = [], noDiscuss = [], role, rating, reviewCount } = userProfile;
  const isListenerProfile = role === 'listener';
  const countryCode = countries.find(c => c.name === country)?.code;
  const countryFlag = countryCode ? countryCodeToEmoji(countryCode) : '🌎';

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <Card className="overflow-hidden">
        <CardHeader className="items-center text-center bg-muted/30 p-8">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
              <AvatarImage src={photoURL} alt={screenName} />
              <AvatarFallback className="text-4xl">{screenName?.[0]}</AvatarFallback>
            </Avatar>
             {isListenerProfile && (
                <div className="absolute bottom-2 -left-2 flex items-center justify-center h-10 w-10 rounded-full bg-background border-2 border-background shadow-md">
                    <span className="text-2xl">{countryFlag}</span>
                </div>
             )}
             <div className={cn(
                "absolute bottom-2 -right-2 h-5 w-5 rounded-full border-4 border-background",
                getStatusColor(userStatus)
            )}></div>
          </div>
          <div className="space-y-1 mt-4">
            <h2 className="text-3xl font-bold">{screenName}</h2>
            <p className="text-lg text-muted-foreground capitalize">{role}{isListenerProfile && reviewCount > 0 && ` (${reviewCount} reviews)`}</p>
             {isListenerProfile && reviewCount > 0 && rating && (
                 <div className="flex justify-center pt-1">
                    {renderStars(rating)}
                 </div>
            )}
          </div>
           {currentUser && currentUser.uid !== userId && (
             <div className="flex flex-col items-center gap-2 mt-4">
                <Button onClick={handleMessage} size="sm" variant="outline">
                    <MessageSquare className="h-4 w-4 mr-2"/>
                    Message
                </Button>
             </div>
           )}
        </CardHeader>

        {isListenerProfile ? (
           <CardContent className="p-6 md:p-8 space-y-8">
                {bio && (
                    <div className="text-center">
                        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: bio }} />
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Country:</span>
                            <span className="text-muted-foreground flex items-center gap-2">{countryFlag} {country}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Languages className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <span className="font-medium">Languages:</span>
                            <span className="text-muted-foreground ml-2">{languages.join(', ')}</span>
                        </div>
                    </div>
                </div>
            
                {livedExperience.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2"><Smile className="h-5 w-5 text-primary"/> Lived Experience</h3>
                        <div className="flex flex-wrap gap-2">
                        {livedExperience.map((topic: string) => (
                            <Badge key={topic} variant="secondary">{topic}</Badge>
                        ))}
                        </div>
                    </div>
                )}

                {noDiscuss.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="h-5 w-5 text-destructive"/> Prefers not to discuss</h3>
                        <div className="flex flex-wrap gap-2">
                        {noDiscuss.map((topic: string) => (
                            <Badge key={topic} variant="destructive">{topic}</Badge>
                        ))}
                        </div>
                    </div>
                )}
                
                {reviews.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2"><Star className="h-5 w-5 text-amber-500"/> Reviews ({reviewCount})</h3>
                    <Card>
                    <CardContent className="p-6 space-y-6">
                        {reviews.map(review => (
                            <div key={review.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium">{review.memberScreenName}</p>
                                    <div className="flex items-center gap-2">
                                    <div className="flex text-amber-500">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-current' : ''}`}/>
                                            ))}
                                    </div>
                                    </div>
                                </div>
                                {review.text && (
                                  <p className="text-muted-foreground italic">"{review.text}"</p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                    </Card>
                </div>
                )}
           </CardContent>
        ) : (
            <CardContent className="p-6 md:p-8 text-center">
                 {bio && (
                    <p className="text-muted-foreground mb-6" dangerouslySetInnerHTML={{ __html: bio }} />
                )}
                <p className="text-sm text-muted-foreground">
                   {"Profile details are private for members."}
                </p>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
