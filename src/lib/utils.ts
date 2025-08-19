import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { intervalToDuration } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSeconds(seconds: number): string {
  if (seconds === 0) return '0с';
  
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  
  const parts = [];
  if (duration.hours) parts.push(`${duration.hours}ч`);
  if (duration.minutes) parts.push(`${duration.minutes}м`);
  if (duration.seconds) parts.push(`${duration.seconds}с`);
  
  return parts.join(' ').trim();
}
