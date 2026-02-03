'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listenerName: string;
  onSubmit: (rating: number, reviewText: string) => void;
}

export function ReviewDialog({ open, onOpenChange, listenerName, onSubmit }: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const handleSubmit = () => {
    onSubmit(rating, reviewText);
    setRating(0);
    setReviewText('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
          <DialogDescription>
            Share your experience with {listenerName}. Your feedback helps others and is greatly appreciated.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-8 w-8 cursor-pointer transition-colors',
                    (hoverRating >= star || rating >= star) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/50'
                  )}
                  onMouseEnter={() => setHoverRating(star)}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="review-text" className="text-sm font-medium">Your Review (Optional)</label>
            <Textarea
              id="review-text"
              placeholder="Tell us about your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={rating === 0}>
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}