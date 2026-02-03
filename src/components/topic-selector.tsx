'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface TopicSelectorProps {
  topics: string[];
  selectedTopics: string[];
  onChange: (topics: string[]) => void;
  maxSelection?: number;
}

export function TopicSelector({ topics, selectedTopics, onChange, maxSelection = 3 }: TopicSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleToggleTopic = (topic: string) => {
    const isSelected = selectedTopics.includes(topic);
    if (isSelected) {
      onChange(selectedTopics.filter(t => t !== topic));
    } else if (selectedTopics.length < maxSelection) {
      onChange([...selectedTopics, topic]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-start h-auto flex-wrap min-h-10"
            >
                {selectedTopics.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                        {selectedTopics.map((topic) => (
                            <Badge
                                key={topic}
                                variant="secondary"
                                className="mr-1"
                            >
                                {topic}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleTopic(topic);
                                    }}
                                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </div>
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <span className="text-muted-foreground">Select topics...</span>
                )}
            </Button>
        </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search topics..." />
          <CommandList>
            <CommandEmpty>No topic found.</CommandEmpty>
            <CommandGroup>
              {topics.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                const isDisabled = !isSelected && selectedTopics.length >= maxSelection;
                return (
                  <CommandItem
                    key={topic}
                    onSelect={() => {
                      if (!isDisabled) {
                        handleToggleTopic(topic);
                      }
                      if (selectedTopics.length + 1 >= maxSelection && !isSelected) {
                        setOpen(false);
                      }
                    }}
                    disabled={isDisabled}
                    className={cn(isDisabled && 'opacity-50 cursor-not-allowed')}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {topic}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
