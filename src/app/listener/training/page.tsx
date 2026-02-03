'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, set, update } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, ArrowRight, BookOpen, CheckSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Icons } from '@/components/icons';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { quizQuestions, type QuizQuestion } from '@/lib/quiz';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import Loading from '@/app/loading';

type TrainingStep = 'intro' | 'quiz' | 'result' | 'guidelines' | 'signup';
const PASSING_SCORE = 80;
const TRAINING_PROGRESS_KEY = 'listenerTrainingProgress';


// --- Main Page Component ---
export default function ListenerTrainingPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState<TrainingStep>(() => {
      if (typeof window !== 'undefined') {
          const savedProgress = sessionStorage.getItem(TRAINING_PROGRESS_KEY);
          if (savedProgress === 'passed_quiz') {
              return 'guidelines';
          }
      }
      return 'intro';
  });

  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // This effect now only handles the case for a LOGGED IN user
    // or when the auth state is first loading.
    if (user !== undefined) {
        setIsLoading(false);
        if (user) {
            // A logged-in user (e.g., a member) is taking the training.
            // We should put them at the quiz step, unless they already passed it.
            const savedProgress = sessionStorage.getItem(TRAINING_PROGRESS_KEY);
            if (savedProgress !== 'passed_quiz') {
                setCurrentStep('quiz');
            } else {
                setCurrentStep('guidelines');
            }
        } else {
            // For a non-logged-in user, initialize to 'intro' if no progress saved.
            const savedProgress = sessionStorage.getItem(TRAINING_PROGRESS_KEY);
            if (savedProgress !== 'passed_quiz') {
                setCurrentStep('intro');
            }
        }
    }
  }, [user]);

  const goToStep = (step: TrainingStep) => {
    setCurrentStep(step);
  };
  
  const onQuizComplete = (score: number) => {
    setQuizScore(score);
    if (score >= PASSING_SCORE) {
        sessionStorage.setItem(TRAINING_PROGRESS_KEY, 'passed_quiz');
    }
    goToStep('result');
  }

  const handleSignupOrContinue = async () => {
    setIsNavigating(true);
    if (user) {
        try {
            const updates: any = {};
            updates[`/users/${user.uid}/role`] = 'listener';
            updates[`/users/${user.uid}/roles/listener/profileCompleted`] = false;
            await update(ref(database), updates);
            router.push('/profile/complete');
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error updating role',
                description: 'Could not switch your role to listener. Please try again.',
            });
            setIsNavigating(false);
        }
    } else {
        goToStep('signup');
        setIsNavigating(false);
    }
  };
  
  const { toast } = useToast();

  if (isLoading || isNavigating) {
    return <Loading />;
  }


  const renderStep = () => {
    switch (currentStep) {
      case 'intro':
        return <IntroStep onNext={() => goToStep('quiz')} />;
      case 'quiz':
        return <QuizStep onComplete={onQuizComplete} />;
      case 'result':
        return <ResultStep score={quizScore} onNext={() => goToStep('guidelines')} onRetry={() => goToStep('quiz')}/>;
      case 'guidelines':
        return <GuidelinesStep onNext={handleSignupOrContinue} isLoading={isNavigating} />;
      case 'signup':
        return <SignupStep />;
      default:
        return <IntroStep onNext={() => goToStep('quiz')} />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
      {renderStep()}
    </div>
  );
}

// --- Step 1: Intro ---
function IntroStep({ onNext }: { onNext: () => void }) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Become a MindToCare Listener</CardTitle>
        <CardDescription>
          Thank you for your interest in becoming a listener. This short training will prepare you for the role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2">The process involves a few simple steps:</h3>
          <ul className="space-y-4 text-muted-foreground">
            <li className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <span className="font-semibold text-foreground">A Short Quiz:</span>
                <p>A 10-question quiz to ensure you understand the core principles of active listening. You'll need to score at least 80% to pass.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
               <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="font-semibold text-foreground">Community Guidelines & Signup:</span>
                <p>You'll need to read and agree to our community guidelines, then create your account.</p>
              </div>
            </li>
          </ul>
        </div>
        <Button onClick={onNext} className="w-full">
          Let's Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Step 2: Quiz ---
function QuizStep({ onComplete }: { onComplete: (score: number) => void }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;

  const handleNext = () => {
    if (!answers[currentQuestionIndex]) {
      setError('Please select an answer.');
      return;
    }
    setError(null);
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      let score = 0;
      quizQuestions.forEach((q, index) => {
        if (answers[index] === q.correctAnswer) {
          score++;
        }
      });
      const percentage = (score / quizQuestions.length) * 100;
      onComplete(percentage);
    }
  };

  const handleAnswerChange = (value: string) => {
    setAnswers({ ...answers, [currentQuestionIndex]: value });
    setError(null);
  };
  
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
        setError(null);
    }
  }

  return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl font-headline">Listener Training Quiz</CardTitle>
          <CardDescription>Question {currentQuestionIndex + 1} of {quizQuestions.length}</CardDescription>
          <Progress value={progress} className="mt-2"/>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="font-semibold text-lg">{currentQuestion.question}</p>
          <RadioGroup value={answers[currentQuestionIndex]} onValueChange={handleAnswerChange}>
            {currentQuestion.options.map((option) => (
              <div key={option} className="flex items-center space-x-2 p-3 rounded-md border has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                <RadioGroupItem value={option} id={option} />
                <Label htmlFor={option} className="flex-1 cursor-pointer">{option}</Label>
              </div>
            ))}
          </RadioGroup>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
              Previous
            </Button>
            <Button onClick={handleNext}>
              {currentQuestionIndex < quizQuestions.length - 1 ? 'Next' : 'Finish Quiz'}
            </Button>
          </div>
        </CardContent>
      </Card>
  );
}

// --- Step 3: Result ---
function ResultStep({ score, onNext, onRetry }: { score: number | null; onNext: () => void; onRetry: () => void; }) {
  if (score === null) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Loading Results...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const passed = score >= PASSING_SCORE;

  return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className={cn("mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4", passed ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900")}>
            {passed ? (
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            ) : (
                <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            )}
          </div>
          <CardTitle className="text-2xl font-headline">
            {passed ? 'Congratulations!' : 'Try Again'}
          </CardTitle>
          <CardDescription>
            You scored {score.toFixed(0)}%. You need 80% to pass.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passed ? (
            <p>You've successfully passed the quiz. The next step is to agree to our community guidelines.</p>
          ) : (
            <p>Please review the principles of active listening and try the quiz again.</p>
          )}
        </CardContent>
        <CardContent>
          {passed ? (
            <Button onClick={onNext} className="w-full">
              Continue to Guidelines
            </Button>
          ) : (
            <Button onClick={onRetry} className="w-full">
              Retake Quiz
            </Button>
          )}
        </CardContent>
      </Card>
  );
}

// --- Step 4: Guidelines ---
function GuidelinesStep({ onNext, isLoading }: { onNext: () => void; isLoading: boolean; }) {
  const [agreed, setAgreed] = useState(false);
  
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Community Guidelines</CardTitle>
        <CardDescription>
          Please read and agree to our guidelines to ensure a safe and supportive community.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
          <ScrollArea className="h-72 w-full rounded-md border p-4">
              <h3 className="font-bold mb-2">1. Maintain Privacy & Confidentiality</h3>
              <p className="mb-4 text-sm text-muted-foreground">Everything shared by a seeker is confidential. Do not share their stories, personal information, or any identifying details outside of the conversation. What is said in MindToCare, stays in MindToCare.</p>
              
              <h3 className="font-bold mb-2">2. Be Respectful & Non-Judgmental</h3>
              <p className="mb-4 text-sm text-muted-foreground">Approach every conversation with empathy and an open mind. Do not impose your personal beliefs, opinions, or solutions. Your role is to listen and support, not to judge or advise.</p>

              <h3 className="font-bold mb-2">3. Prioritize Safety</h3>
              <p className="mb-4 text-sm text-muted-foreground">You are not a crisis counselor. If a user expresses intent to harm themselves or others, you must immediately guide them to professional help and use the "Report" feature. Do not attempt to handle crisis situations on your own.</p>
              
              <h3 className="font-bold mb-2">4. Do Not Give Advice</h3>
              <p className="mb-4 text-sm text-muted-foreground">Your role is to be an active listener, not a therapist or a coach. Avoid giving direct advice, telling seekers what to do, or sharing what you would do in their situation. Instead, help them explore their own feelings and solutions by asking open-ended questions.</p>

              <h3 className="font-bold mb-2">5. Respect Boundaries</h3>
              <p className="text-sm text-muted-foreground">Do not ask for personal contact information or attempt to move the conversation off-platform. Keep the relationship professional and within the bounds of the listener-seeker dynamic established by MindToCare.</p>
          </ScrollArea>
          <div className="flex items-center space-x-2">
              <Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(checked as boolean)} />
              <Label htmlFor="terms" className="cursor-pointer">I have read and agree to follow the community guidelines.</Label>
          </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onNext} disabled={!agreed || isLoading} className="w-full">
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Agree and Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- Step 5: Signup ---
const signupFormSchema = z.object({
  name: z.string().min(1, { message: 'Please enter your name.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});
type SignupFormValue = z.infer<typeof signupFormSchema>;

function SignupStep() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupFormValue>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const handleSignUp = async ({ name, email, password }: SignupFormValue) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = ref(database, 'users/' + user.uid);
      await set(userRef, {
        name: name,
        email: user.email,
        createdAt: Date.now(),
        role: 'listener', // Default active role
        roles: {
            member: { profileCompleted: false },
            listener: { profileCompleted: false }
        },
        sharedProfile: {},
      });

      toast({
        title: 'Account Created!',
        description: 'Welcome to the listener team. Please complete your profile.',
      });
      router.push('/profile/complete');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'Could not create account. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
           <div className="mx-auto mb-4">
            <Icons.logo className="h-10 w-10 text-primary sm:h-12 sm:w-12"/>
          </div>
          <CardTitle className="text-xl font-headline sm:text-2xl">Listener Signup</CardTitle>
          <CardDescription>
            You've completed the training! Create your listener account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Listener Account'}
                <UserPlus className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
  );
}
