import { firestoreInstance, isFirebaseConfigured } from './config';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export interface LogbookEntry {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  note: string;
  timestamp: number;
}

export const INITIAL_DEMO_ENTRIES: LogbookEntry[] = [
  {
    id: 'demo-1',
    date: '18 Sep 2026',
    amount: 18400,
    type: 'income',
    category: 'Sales',
    note: 'Cooperative bulk milk supply (320 L)',
    timestamp: Date.now() - 86400000 * 1,
  },
  {
    id: 'demo-2',
    date: '16 Sep 2026',
    amount: 6250,
    type: 'expense',
    category: 'Supplies',
    note: 'Cattle feed pellets & mineral mix (5 bags)',
    timestamp: Date.now() - 86400000 * 3,
  },
  {
    id: 'demo-3',
    date: '15 Sep 2026',
    amount: 12800,
    type: 'income',
    category: 'Sales',
    note: 'Retail morning milk delivery to village households',
    timestamp: Date.now() - 86400000 * 4,
  },
  {
    id: 'demo-4',
    date: '12 Sep 2026',
    amount: 1950,
    type: 'expense',
    category: 'Healthcare',
    note: 'Veterinary doctor visit & annual vaccinations',
    timestamp: Date.now() - 86400000 * 7,
  },
  {
    id: 'demo-5',
    date: '08 Sep 2026',
    amount: 14500,
    type: 'income',
    category: 'Sales',
    note: 'Weekly cooperative milk payout',
    timestamp: Date.now() - 86400000 * 11,
  },
  {
    id: 'demo-6',
    date: '04 Sep 2026',
    amount: 4500,
    type: 'expense',
    category: 'Fodder',
    note: 'Green fodder tractor load from neighboring farm',
    timestamp: Date.now() - 86400000 * 15,
  },
];

const getStorageKey = (userId: string) => `ruralcred_logbook_${userId}`;

export async function fetchLogbookEntries(userId: string): Promise<LogbookEntry[]> {
  if (!userId) return [];

  // If Firestore configured and online, attempt to fetch from user's isolated subcollection
  if (isFirebaseConfigured && firestoreInstance) {
    try {
      const colRef = collection(firestoreInstance, `users/${userId}/logbook`);
      const q = query(colRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LogbookEntry));
      }
    } catch (e) {
      console.warn('Firestore fetch failed, using local storage cache:', e);
    }
  }

  // Fallback to isolated user localStorage
  if (typeof window !== 'undefined') {
    const key = getStorageKey(userId);
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    // Seed default demo entries only for the Anita Sharma dairy demo persona
    if (userId.includes('anita') || userId === 'demo-user') {
      localStorage.setItem(key, JSON.stringify(INITIAL_DEMO_ENTRIES));
      return INITIAL_DEMO_ENTRIES;
    }
    // New user starts with empty logbook
    return [];
  }

  return userId.includes('anita') ? INITIAL_DEMO_ENTRIES : [];
}

export async function addLogbookEntry(
  entry: Omit<LogbookEntry, 'id'>,
  userId: string
): Promise<LogbookEntry> {
  const newEntry: LogbookEntry = {
    ...entry,
    id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  };

  if (!userId) return newEntry;

  if (isFirebaseConfigured && firestoreInstance) {
    try {
      const colRef = collection(firestoreInstance, `users/${userId}/logbook`);
      const docRef = await addDoc(colRef, { ...entry });
      newEntry.id = docRef.id;
    } catch (e) {
      console.warn('Firestore write failed, preserving to local storage:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const key = getStorageKey(userId);
    const current = await fetchLogbookEntries(userId);
    const updated = [newEntry, ...current];
    localStorage.setItem(key, JSON.stringify(updated));
  }

  return newEntry;
}

export async function deleteLogbookEntry(id: string, userId: string): Promise<void> {
  if (!userId) return;

  if (isFirebaseConfigured && firestoreInstance) {
    try {
      await deleteDoc(doc(firestoreInstance, `users/${userId}/logbook`, id));
    } catch (e) {
      console.warn('Firestore delete failed:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const key = getStorageKey(userId);
    const current = await fetchLogbookEntries(userId);
    const updated = current.filter((e) => e.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
  }
}
