import { en } from './en';
import { te } from './te';
import { hi } from './hi';

export type Language = 'en' | 'te' | 'hi';

export function getDictionary(lang: Language) {
  if (lang === 'te') return te;
  if (lang === 'hi') return hi;
  return en;
}

export { en, te, hi };
