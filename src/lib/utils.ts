import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toTitleCase(str: string) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    // Handle names like "da", "de", "do", "dos", "das" if needed, 
    // but the requirement says: "a primeira letra do nome e de cada sobrenome maiuscula, e as demais letras minusculas"
    // Let's just capitalize everything that is separated by space.
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}
