import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combineert Tailwind-klassen en lost conflicten op (laatste wint). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
