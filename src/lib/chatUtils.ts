
import { format, isToday, isYesterday, isSameDay, isSameYear, formatDistanceToNowStrict } from 'date-fns';

type RealtimeStatus = 'online' | 'busy' | 'offline';

export interface OtherParticipant {
    identity: string;
    uid: string;
    role: 'member' | 'listener';
    screenName: string | null;
    photoURL?: string;
    status: RealtimeStatus;
}

export const getIdentitiesFromChatId = (chatId: string): [string, string] | null => {
    const parts = chatId.split('__');
    if (parts.length === 2) {
        return parts as [string, string];
    }
    return null;
};

export const getUidFromIdentity = (identity: string): string => {
    const lastUnderscoreIndex = identity.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) return identity; // Fallback for old data if any
    return identity.substring(0, lastUnderscoreIndex);
};

export const getRoleFromIdentity = (identity: string): 'member' | 'listener' => {
    const lastUnderscoreIndex = identity.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) return 'member'; // Fallback for old data if any
    const role = identity.substring(lastUnderscoreIndex + 1);
    if (role === 'listener') {
        return 'listener';
    }
    return 'member';
};


export const getInitials = (name: string | null | undefined): string => {
    if (!name) return '??';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.substring(0, 2).toUpperCase();
};


export const getDateSeparator = (date: Date): string => {
    const now = new Date();
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isSameYear(date, now)) return format(date, 'EEEE, MMM d');
    return format(date, 'EEEE, MMM d, yyyy');
};

export const formatPreciseDistance = (timestamp: number): string => {
    const distance = formatDistanceToNowStrict(new Date(timestamp)); // e.g., "5 minutes"
    const parts = distance.split(' ');

    if (parts.length !== 2) {
      // Fallback for cases that don't fit the "X unit" pattern.
      return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
    }

    const [value, unit] = parts;
    let shortUnit = '';

    switch (unit) {
      case 'second':
      case 'seconds':
        shortUnit = 's';
        break;
      case 'minute':
      case 'minutes':
        shortUnit = 'min';
        break;
      case 'hour':
      case 'hours':
        shortUnit = 'h';
        break;
      case 'day':
      case 'days':
        shortUnit = 'd';
        break;
      case 'month':
      case 'months':
        shortUnit = 'm';
        break;
      case 'year':
      case 'years':
        shortUnit = 'y';
        break;
      default:
        shortUnit = unit;
    }
    return `${value}${shortUnit} ago`;
};

export const getStatusColor = (status: RealtimeStatus): string => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
      default:
        return 'bg-slate-400';
    }
};
