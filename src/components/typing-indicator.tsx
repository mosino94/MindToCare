
'use client';

import { motion } from 'framer-motion';

export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground">
        <div className="flex items-center space-x-1">
            <motion.div
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
            />
            <motion.div
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            />
            <motion.div
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            />
        </div>
        <span>{name} is typing...</span>
    </div>
  );
}
