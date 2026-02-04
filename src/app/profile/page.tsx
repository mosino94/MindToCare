'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { database, storage } from '@/lib/firebase';
import { ref as dbRef, update, get, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { countries } from '@/lib/countries';
import { languages } from '@/lib/languages';
import { religions } from '@/lib/religions';
import { MENTAL_HEALTH_TOPICS } from '@/lib/topics';
import { Loader2, Upload, UnfoldVertical, Check, X, Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { debounce } from 'lodash';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { defaultAvatars } from '@/lib/avatars';
import Image from 'next/image';

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
    if (isListener) {
        return baseProfileSchema.superRefine((data, ctx) => {
            if (!data.country) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a country.", path: ["country"] });
            }
            if (!data.languages || data.languages.length === 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select at least one language.", path: ["languages"] });
            }
            if (!data.religion) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a religion.", path: ["religion"] });
            }
        });
    }
    return baseProfileSchema;
};

type ProfileFormValues = z.infer<typeof baseProfileSchema>;
type ListenerStatus = 'available' | 'busy' | 'offline';

export default function ProfilePage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [religionOpen, setReligionOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  
  const [originalScreenName, setOriginalScreenName] = useState('');
  
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | 'idle'>('idle');
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null);
  const [customReligion, setCustomReligion] = useState('');
  const [listenerStatus, setListenerStatus] = useState<ListenerStatus>('offline');

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
    if (!user || screenName.length < 3 || screenName.toLowerCase() === originalScreenName) {
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
  }, 500), [user, form, originalScreenName]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'screenName' && value.screenName !== undefined) {
        checkUsername(value.screenName);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, checkUsername]);


  useEffect(() => {
    if (!user) return;
    
    setPageLoading(true);
    const userRef = dbRef(database, `users/${user.uid}`);
    get(userRef).then((snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.val();
            const currentRoleProfile = data.roles?.[role] || {};
            const sharedProfile = data.sharedProfile || {};
            
            const defaultValues: Partial<ProfileFormValues> = {
                ...sharedProfile,
                ...currentRoleProfile,
            };

            if (isListener && currentRoleProfile.photoURL && defaultAvatars.some(a => a.url === currentRoleProfile.photoURL)) {
                defaultValues.selectedAvatar = currentRoleProfile.photoURL;
            }

            form.reset(defaultValues);
            setOriginalScreenName(currentRoleProfile.screenName?.toLowerCase() || '');
            setImagePreview(currentRoleProfile.photoURL || null);
            
            if (role === 'listener') {
                setListenerStatus(data.status || 'offline');
            }
        }
    }).finally(() => {
        setPageLoading(false);
    });

  }, [user, form, role, isListener]);
  
  const handleStatusChange = (newStatus: ListenerStatus) => {
    if (!user || role !== 'listener') return;

    const statusRef = dbRef(database, `users/${user.uid}/status`);
    set(statusRef, newStatus);
    setListenerStatus(newStatus);
  };

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
      const userData = userSnapshot.val() || {};

      const { profilePicture, selectedAvatar, screenName, bio, age, gender, country, languages, religion, livedExperience, noDiscuss } = data;
      
      let photoURL = userData.roles?.[role]?.photoURL || '';
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
        ...userData.sharedProfile,
        age, gender, country, languages, religion,
      };

      const roleSpecificUpdates: any = { bio, photoURL, screenName };
      if (isListener) {
        roleSpecificUpdates.livedExperience = livedExperience;
        roleSpecificUpdates.noDiscuss = noDiscuss;
      }
      updates[`/users/${user.uid}/roles/${role}`] = {
        ...userData.roles?.[role],
        ...roleSpecificUpdates
      };
      
      const newScreenNameLower = screenName.toLowerCase();
      if (newScreenNameLower !== originalScreenName) {
        const otherRole = role === 'listener' ? 'member' : 'listener';
        const otherRoleScreenNameLower = userData.roles?.[otherRole]?.screenName?.toLowerCase();

        if (originalScreenName && originalScreenName !== otherRoleScreenNameLower) {
            updates[`/users_screenames/${originalScreenName}`] = null;
        }
        updates[`/users_screenames/${newScreenNameLower}`] = user.uid;
      }

      await update(dbRef(database), updates);
      
      toast({
        title: "Profile Updated!",
        description: "Your changes have been saved.",
      });
      
      if(newScreenNameLower !== originalScreenName) {
          setOriginalScreenName(newScreenNameLower);
          setUsernameStatus('idle');
      }

    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: 'Could not update your profile. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };
  
    if (pageLoading) {
      return (
         <div className="container mx-auto p-4 md:p-8 max-w-2xl">
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-full mt-2" />
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
      )
    }

  const formLabel = (label: string, required: boolean) => (
    <>
      {label} {!required && <span className="text-muted-foreground text-xs">(Optional)</span>}
    </>
  );

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Edit Your Profile</CardTitle>
          <CardDescription>
            Changes apply to your current <span className='font-bold capitalize'>{role}</span> role.
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
                    <FormLabel>Profile Picture (Optional)</FormLabel>
                    <FormControl>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={imagePreview ?? undefined} />
                                <AvatarFallback className="text-3xl">{user?.email?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1.5">
                                <Input id="picture" type="file" accept="image/png, image/jpeg" onChange={e => {
                                  field.onChange(e.target.files)
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
                                }} className="hidden"/>
                                <Button asChild variant="outline">
                                    <label htmlFor="picture" className="cursor-pointer">
                                        <Upload className="mr-2 h-4 w-4"/> Change Image
                                    </label>
                                </Button>
                                <p className="text-xs text-muted-foreground">PNG or JPG up to 10MB.</p>
                            </div>
                        </div>
                    </FormControl>
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
                      This information is shared between profiles.
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
                                value={customReligion}
                                onValueChange={setCustomReligion}
                            />
                            <CommandList>
                            <CommandEmpty>
                                <CommandItem
                                    onSelect={() => {
                                        form.setValue("religion", customReligion)
                                        setReligionOpen(false)
                                    }}
                                 >
                                    Use "{customReligion}"
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
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
