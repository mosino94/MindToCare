'use client';

import { useAuth } from '@/hooks/use-auth';
import { database } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Icons } from './icons';
import { User } from 'lucide-react';
import { useState } from 'react';

interface RoleSelectionDialogProps {
  open: boolean;
  onRoleSelect: () => void;
}

export function RoleSelectionDialog({ open, onRoleSelect }: RoleSelectionDialogProps) {
  const { user } = useAuth();
  const [loadingRole, setLoadingRole] = useState<'member' | 'listener' | null>(null);

  const handleSelectRole = async (role: 'member' | 'listener') => {
    if (!user) return;
    setLoadingRole(role);
    try {
      const userRef = ref(database, `users/${user.uid}`);
      await update(userRef, { role: role });
      onRoleSelect();
    } catch (error) {
      console.error("Failed to update role", error);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline">Choose Your Role</DialogTitle>
          <DialogDescription>
            You have profiles for both roles. Which one would you like to use for this session?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="h-28 flex-col gap-2 text-base"
            onClick={() => handleSelectRole('member')}
            disabled={!!loadingRole}
          >
            {loadingRole === 'member' ? <Icons.logo className="h-6 w-6 animate-spin"/> : <User className="h-6 w-6"/>}
            <span>Member</span>
          </Button>
          <Button
            variant="outline"
            className="h-28 flex-col gap-2 text-base"
            onClick={() => handleSelectRole('listener')}
            disabled={!!loadingRole}
          >
            {loadingRole === 'listener' ? <Icons.logo className="h-6 w-6 animate-spin"/> : <Icons.logo className="h-6 w-6"/>}
            <span>Listener</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
