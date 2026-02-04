'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { database, storage } from '@/lib/firebase';
import { ref as dbRef, update, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { countries } from '@/lib/countries';
import { languages } from '@/lib/languages';
import { religions } from '@/lib/religions';
import { MENTAL_HEALTH_TOPICS } from '@/lib/topics';
import { Loader2, Upload, UnfoldVertical, Check, X, Info, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { debounce } from 'lodash';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { defaultAvatars } from '@/lib/avatars';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const TRAINING_PROGRESS_KEY = 'listenerTrainingProgress';

const baseProfileSchema = z.object({
    profilePicture: z.any().optional(),
    selectedAvatar: z.string().optional(),
    screenName: z.string().min(3, 'Screen name must be at least 3 characters.').max(18, 'Screen name must be 18 characters or less.'),
    bio: z.string().max(500, 'Bio can be up to 500 characters.').optional().default(''),
    age: z.coerce.number().min(16, 'You must be at least 16 years old.').max(100),
    gender: z.string().min(1, 'Please select a gender.'),
    country: z.string().optional().default(''),
    languages: z.array(z.string()).optional().default([]),
    religion: z.string().optional().default(''),
    livedExperience: z.array(z.string()).optional().default([]),
    noDiscuss: z.array(z.string()).optional().default([]),
});

const createProfileSchema = (isListener: boolean) => {
    let schema: z.ZodTypeAny = baseProfileSchema;
    if (isListener) {
        schema = schema
            .refine(data => !!data.profilePicture || !!data.selectedAvatar, {
                message: "Please upload a profile picture or select a default avatar.",
                path: ["profilePicture"],
            })
            .refine(data => !!data.country && data.country.length > 0, {
                message: "Please select a country.",
                path: ["country"],
            })
            .refine(data => data.languages && data.languages.length > 0, {
                message: "Please select at least one language.",
                path: ["languages"],
            })
            .refine(data => !!data.religion && data.religion.length > 0, {
                message: "Please select a religion.",
                path: ["religion"],
            });
    }
    return schema;
};

type ProfileFormValues = z.infer<typeof baseProfileSchema>;

export default function CompleteProfilePage() {
  const { user, role, name, photoURL: authPhotoURL } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [religionOpen, setReligionOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | 'idle'>('idle');
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null);
  
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [guidelinesAgreed, setGuidelinesAgreed] = useState(false);
  
  const isListener = role === 'listener';
  const profileSchema = createProfileSchema(isListener);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      screenName: '',
      bio: '',
      age: '' as any,
      gender: '',
      religion: '',
      country: '',
      languages: [],
      livedExperience: [],
      noDiscuss: [],
      profilePicture: undefined,
      selectedAvatar: '',
    },
  });

  const checkUsername = useCallback(debounce(async (screenName: string) => {
    if (!user || screenName.length < 3) {
      setUsernameStatus('idle');
      setUsernameSuggestion(null);
      form.clearErrors('screenName');
      return;
    }
    setUsernameStatus('checking');
    setUsernameSuggestion(null);
    form.clearErrors('screenName');

    try {
      const screenNameLower = screenName.toLowerCase();
      const screenNameRef = dbRef(database, `users_screenames/${screenNameLower}`);
      const snapshot = await get(screenNameRef);

      if (snapshot.exists() && snapshot.val() !== user.uid) {
        setUsernameStatus('taken');
        const suggestion = `${screenName}${Math.floor(100 + Math.random() * 900)}`;
        setUsernameSuggestion(suggestion);
        form.setError('screenName', {
          type: 'manual',
          message: `This name is already taken globally.`,
        });
      } else {
        setUsernameStatus('available');
      }
    } catch (error: any) {
      console.error('Failed to check username', error);
      let errorMessage = 'Could not verify username. Please try again.';
      form.setError('screenName', { type: 'manual', message: errorMessage });
      setUsernameStatus('idle');
    }
  }, 500), [user, form]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TRAINING_PROGRESS_KEY);
    }
  }, []);
  
  useEffect(() => {
    if (user) {
      setPageLoading(true);
      const userRef = dbRef(database, `users/${user.uid}`);
      get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const currentRoleProfile = data.roles?.[role] || {};
          const sharedProfile = data.sharedProfile || {};
          
          const defaultValues: Partial<ProfileFormValues> = {
            screenName: currentRoleProfile.screenName || data.name?.split(' ')[0].substring(0, 18) || '',
            bio: currentRoleProfile.bio || '',
            age: sharedProfile.age || '',
            gender: sharedProfile.gender || '',
            religion: sharedProfile.religion || '',
            country: sharedProfile.country || '',
            languages: sharedProfile.languages || [],
            livedExperience: currentRoleProfile.livedExperience || [],
            noDiscuss: currentRoleProfile.noDiscuss || [],
            selectedAvatar: currentRoleProfile.photoURL && defaultAvatars.some((a: any) => a.url === currentRoleProfile.photoURL) ? currentRoleProfile.photoURL : '',
          };
          form.reset(defaultValues);
          
          const initialPhoto = currentRoleProfile.photoURL || authPhotoURL;
          if (initialPhoto) {
            setImagePreview(initialPhoto);
            if (defaultAvatars.some(a => a.url === initialPhoto)) {
              form.setValue('selectedAvatar', initialPhoto);
            }
          }
          
          if (defaultValues.screenName && defaultValues.screenName.length >= 3) {
            checkUsername(defaultValues.screenName);
          }
        }
      }).finally(() => {
        setPageLoading(false);
      });
    }
  }, [user, name, authPhotoURL, form, role, checkUsername]);

  useEffect(() => {
    if (role === 'member') {
      setIsGuidelinesOpen(true);
    }
  }, [role]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'screenName' && value.screenName) {
        checkUsername(value.screenName);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, checkUsername]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    if (usernameStatus === 'taken' || usernameStatus === 'checking') {
        toast({
            variant: 'destructive',
            title: 'Screen Name Issue',
            description: usernameStatus === 'taken' ? 'Please choose a different screen name.' : 'Please wait for the name check to complete.',
        });
        return;
    }
    
    setLoading(true);

    try {
      const userRef = dbRef(database, `users/${user.uid}`);
      const userSnapshot = await get(userRef);
      const existingUserData = userSnapshot.val() || {};

      const { profilePicture, selectedAvatar, screenName, bio, age, gender, country, languages, religion, livedExperience, noDiscuss } = data;
      
      let photoURL = existingUserData.roles?.[role]?.photoURL || authPhotoURL || '';
      if (profilePicture && profilePicture.length > 0) {
        const file = profilePicture[0];
        const fileRef = storageRef(storage, `profile-pictures/${user.uid}/${role}`);
        await uploadBytes(fileRef, file);
        photoURL = await getDownloadURL(fileRef);
      } else if (isListener && selectedAvatar) {
        photoURL = selectedAvatar;
      }
      
      const updates: { [key: string]: any } = {};

      updates[`/users/${user.uid}/sharedProfile`] = {
        ...existingUserData.sharedProfile,
        age, gender, country, languages, religion,
      };

      const roleSpecificUpdates: any = { bio, photoURL, screenName, profileCompleted: true };
      if (isListener) {
        roleSpecificUpdates.livedExperience = livedExperience;
        roleSpecificUpdates.noDiscuss = noDiscuss;
      }
      updates[`/users/${user.uid}/roles/${role}`] = {
        ...existingUserData.roles?.[role],
        ...roleSpecificUpdates
      };

      const newScreenNameLower = screenName.toLowerCase();
      updates[`/users_screenames/${newScreenNameLower}`] = user.uid;
      
      await update(dbRef(database), updates);
      
      toast({
        title: "Profile Complete!",
        description: "Welcome to MindToCare.",
      });

      router.push('/');

    } catch (error) {
      console.error('Profile completion error:', error);
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: 'Could not complete your profile. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const formLabel = (label: string, required: boolean) => (
    <>
      {label} {!required && <span className="text-muted-foreground text-xs">(Optional)</span>}
    </>
  );

  if (pageLoading) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
           <Card className="w-full max-w-2xl">
              <CardHeader>
                  <CardTitle className="text-2xl font-headline">Complete Your Profile</CardTitle>
                  <CardDescription>Loading your information...</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <div className="grid grid-cols-2 gap-8">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                      </div>
                  </div>
              </CardContent>
           </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
      <Dialog open={isGuidelinesOpen} onOpenChange={(open) => { if (guidelinesAgreed || !open) setIsGuidelinesOpen(open); }}>
          <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <DialogHeader>
                  <DialogTitle className="text-2xl font-headline flex items-center gap-2"><ShieldCheck/> Member Guidelines</DialogTitle>
                  <DialogDescription>
                      Welcome to MindToCare! All members must agree to these guidelines.
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-72 w-full rounded-md border p-4 my-4">
                  <h3 className="font-bold mb-2">1. Be Respectful</h3>
                  <p className="mb-4 text-sm text-muted-foreground">Treat listeners with kindness and respect.</p>

                  <h3 className="font-bold mb-2">2. This is Not a Crisis Service</h3>
                  <p className="mb-4 text-sm text-muted-foreground">MindToCare is for supportive conversations, not for emergencies.</p>

                  <h3 className="font-bold mb-2">3. Respect Privacy and Boundaries</h3>
                  <p className="mb-4 text-sm text-muted-foreground">Do not ask listeners for personal contact information.</p>
                  
                  <h3 className="font-bold mb-2">4. Be Honest and Open</h3>
                  <p className="mb-4 text-sm text-muted-foreground">Share what you feel comfortable sharing.</p>
                  
                  <h3 className="font-bold mb-2">5. Provide Constructive Feedback</h3>
                  <p className="text-sm text-muted-foreground">Feedback helps our listeners grow.</p>
              </ScrollArea>
              <div className="flex items-center space-x-2">
                  <Checkbox id="guidelines-agree-complete" onCheckedChange={(checked) => setGuidelinesAgreed(checked as boolean)} />
                  <Label htmlFor="guidelines-agree-complete" className="cursor-pointer">I have read and agree to follow the member guidelines.</Label>
              </div>
              <DialogFooter>
                  <Button onClick={() => {
                      if (guidelinesAgreed) {
                          setIsGuidelinesOpen(false);
                      }
                  }} disabled={!guidelinesAgreed}>
                      Agree and Continue
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Complete Your {role === 'listener' ? 'Listener' : 'Member'} Profile</CardTitle>
          <CardDescription>
            Help others get to know you better.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <FormField
                control={form.control}
                name="profilePicture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{formLabel("Profile Picture", isListener)}</FormLabel>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={imagePreview ?? undefined} />
                            <AvatarFallback className="text-3xl">{user?.email?.[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-1.5">
                            <FormControl>
                                <Input id="picture" type="file" accept="image/png, image/jpeg" onChange={e => {
                                    field.onChange(e.target.files);
                                    if (e.target.files && e.target.files.length > 0) {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 10 * 1024 * 1024) { // 10MB
                                          form.setError('profilePicture', {
                                            type: 'manual',
                                            message: 'Image must be less than 10MB.',
                                          });
                                          return;
                                        }
                                        form.setValue('selectedAvatar', '');
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          setImagePreview(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }
                                }} className="hidden"/>
                            </FormControl>
                            <Button asChild variant="outline">
                                <label htmlFor="picture" className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4"/> Upload Image
                                </label>
                            </Button>
                            <p className="text-xs text-muted-foreground">PNG or JPG up to 10MB.</p>
                        </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isListener && (
                <>
                  <p className="text-sm text-muted-foreground text-center -mt-4">or select a default avatar</p>
                  <FormField
                    control={form.control}
                    name="selectedAvatar"
                    render={({ field }) => (
                      <FormItem>
                          <div className="grid grid-cols-5 gap-2 pt-2">
                            {defaultAvatars.map(avatar => (
                              <button
                                key={avatar.id}
                                type="button"
                                data-ai-hint={avatar.hint}
                                onClick={() => {
                                  field.onChange(avatar.url);
                                  setImagePreview(avatar.url);
                                  form.setValue('profilePicture', undefined);
                                  form.clearErrors('profilePicture');
                                }}
                                className={cn(
                                  "rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                  field.value === avatar.url ? "ring-2 ring-primary ring-offset-2" : "ring-0"
                                )}
                              >
                                <Image
                                  src={avatar.url}
                                  alt={`Default avatar ${avatar.id}`}
                                  width={200}
                                  height={200}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="screenName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Screen Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your public display name" {...field} maxLength={18} />
                    </FormControl>
                    <FormDescription>
                        This is your public name. You can only change your screen name twice within one week.
                    </FormDescription>
                     <div className="h-5">
                        {usernameStatus === 'checking' && <p className="text-sm text-muted-foreground">Checking availability...</p>}
                        {usernameStatus === 'available' && <p className="text-sm font-medium text-green-600">Available</p>}
                        <FormMessage />
                     </div>
                     {usernameStatus === 'taken' && usernameSuggestion && (
                        <div className="text-sm text-muted-foreground p-2 bg-accent/20 border border-dashed rounded-md">
                            Suggested name: <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => form.setValue('screenName', usernameSuggestion, { shouldValidate: true })}>{usernameSuggestion}</Button>
                        </div>
                     )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Tell us a little about yourself" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                      The following information is shared between profiles.
                  </AlertDescription>
              </Alert>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{formLabel("Age", true)}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 25" {...field} onChange={event => field.onChange(event.target.value === '' ? '' : +event.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{formLabel("Gender", true)}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="non-binary">Non-binary</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{formLabel("Country", isListener)}</FormLabel>
                       <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? countries.find(
                                    (country) => country.name === field.value
                                  )?.name
                                : "Select country"}
                              <UnfoldVertical className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search country..." />
                            <CommandList>
                              <CommandEmpty>No country found.</CommandEmpty>
                              <CommandGroup>
                                {countries.map((country) => (
                                  <CommandItem
                                    value={country.name}
                                    key={country.code}
                                    onSelect={() => {
                                      form.setValue("country", country.name)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        country.name === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {country.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                    control={form.control}
                    name="languages"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>{formLabel("Languages", isListener)}</FormLabel>
                        <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between h-auto"
                                >
                                <div className="flex gap-1 flex-wrap">
                                    {field.value && field.value.length > 0 ? (
                                    field.value.map((language: string) => (
                                        <Badge
                                        variant="secondary"
                                        key={language}
                                        className="mr-1 mb-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newLangs = field.value.filter((l: string) => l !== language);
                                          form.setValue("languages", newLangs);
                                        }}
                                        >
                                        {language}
                                        <X className="ml-1 h-3 w-3" />
                                        </Badge>
                                    ))
                                    ) : (
                                    <span>Select languages</span>
                                    )}
                                </div>
                                <UnfoldVertical className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search language..." />
                                <CommandList>
                                <CommandEmpty>No language found.</CommandEmpty>
                                <CommandGroup>
                                    {languages.map((language) => (
                                    <CommandItem
                                        value={language.name}
                                        key={language.code}
                                        onSelect={() => {
                                            const currentLangs = form.getValues("languages") || [];
                                            if (currentLangs.includes(language.name)) {
                                                form.setValue("languages", currentLangs.filter(l => l !== language.name));
                                            } else {
                                                form.setValue("languages", [...currentLangs, language.name]);
                                            }
                                        }}
                                    >
                                        <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value && field.value.includes(language.name)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                        />
                                        {language.name}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </CommandList>
                            </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
              </div>

               <FormField
                control={form.control}
                name="religion"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>{formLabel("Religion", isListener)}</FormLabel>
                    <Popover open={religionOpen} onOpenChange={setReligionOpen}>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value || "Select or type a religion"}
                            <UnfoldVertical className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput 
                                placeholder="Search or type religion..."
                            />
                            <CommandList>
                            <CommandEmpty>
                                 <CommandItem
                                     onSelect={() => {
                                        const value = (document.querySelector('[cmdk-input]') as HTMLInputElement)?.value;
                                        form.setValue("religion", value)
                                        setReligionOpen(false)
                                    }}
                                 >
                                    Use "{form.watch('religion')}"
                                 </CommandItem>
                            </CommandEmpty>
                            <CommandGroup>
                                {religions.map((religion) => (
                                <CommandItem
                                    value={religion}
                                    key={religion}
                                    onSelect={() => {
                                        form.setValue("religion", religion)
                                        setReligionOpen(false)
                                    }}
                                >
                                    <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        religion === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                    />
                                    {religion}
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />

              {role === 'listener' && (
                <>
                  <FormField
                    control={form.control}
                    name="livedExperience"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base">Experience With (Optional)</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {MENTAL_HEALTH_TOPICS.map((item) => (
                          <FormField
                            key={item}
                            control={form.control}
                            name="livedExperience"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), item])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value: string) => value !== item
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {item}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                   <FormField
                    control={form.control}
                    name="noDiscuss"
                    render={() => (
                      <FormItem>
                         <div className="mb-4">
                            <FormLabel className="text-base">Won't Discuss (Optional)</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {MENTAL_HEALTH_TOPICS.map((item) => (
                          <FormField
                            key={item}
                            control={form.control}
                            name="noDiscuss"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), item])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value: string) => value !== item
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {item}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <Button type="submit" disabled={loading || form.formState.isSubmitting || usernameStatus === 'checking' || usernameStatus === 'taken'} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save and Continue
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}