import { en } from './en';
import { te } from './te';

export type Language = 'en' | 'te';

export function getDictionary(lang: Language) {
  return lang === 'te' ? te : en;
}

export { en, te };
