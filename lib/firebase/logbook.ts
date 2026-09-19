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

export const INITIAL_KIRANA_ENTRIES: LogbookEntry[] = [
  {
    id: 'kirana-1',
    date: '18 Sep 2026',
    amount: 14200,
    type: 'income',
    category: 'Sales',
    note: 'Daily counter retail sales & groceries',
    timestamp: Date.now() - 86400000 * 1,
  },
  {
    id: 'kirana-2',
    date: '17 Sep 2026',
    amount: 8500,
    type: 'expense',
    category: 'Inventory',
    note: 'Wholesale grains, pulses & edible oil restock',
    timestamp: Date.now() - 86400000 * 2,
  },
  {
    id: 'kirana-3',
    date: '15 Sep 2026',
    amount: 9800,
    type: 'income',
    category: 'Sales',
    note: 'UPI QR settlements & festival snack packages',
    timestamp: Date.now() - 86400000 * 4,
  },
  {
    id: 'kirana-4',
    date: '12 Sep 2026',
    amount: 1200,
    type: 'expense',
    category: 'Utilities',
    note: 'Shop electricity bill & refrigerator maintenance',
    timestamp: Date.now() - 86400000 * 7,
  },
  {
    id: 'kirana-5',
    date: '08 Sep 2026',
    amount: 16500,
    type: 'income',
    category: 'Sales',
    note: 'Weekly mandi bulk supply to village tiffin centers',
    timestamp: Date.now() - 86400000 * 11,
  },
];

export const INITIAL_WEAVING_ENTRIES: LogbookEntry[] = [
  {
    id: 'weaving-1',
    date: '18 Sep 2026',
    amount: 22000,
    type: 'income',
    category: 'Sales',
    note: 'Handloom Pochampally silk sarees delivered to weavers cooperative',
    timestamp: Date.now() - 86400000 * 1,
  },
  {
    id: 'weaving-2',
    date: '16 Sep 2026',
    amount: 7800,
    type: 'expense',
    category: 'Raw Materials',
    note: 'Mulberry raw silk yarn & natural dyes purchase',
    timestamp: Date.now() - 86400000 * 3,
  },
  {
    id: 'weaving-3',
    date: '14 Sep 2026',
    amount: 15500,
    type: 'income',
    category: 'Sales',
    note: 'Custom bridal border saree delivery to local boutique',
    timestamp: Date.now() - 86400000 * 5,
  },
  {
    id: 'weaving-4',
    date: '10 Sep 2026',
    amount: 1400,
    type: 'expense',
    category: 'Equipment',
    note: 'Pit loom shuttle replacement & reed tuning',
    timestamp: Date.now() - 86400000 * 9,
  },
];

const getStorageKey = (userId: string) => `ruralcred_logbook_${userId}`;

export async function fetchLogbookEntries(userId: string): Promise<LogbookEntry[]> {
  if (!userId) return INITIAL_DEMO_ENTRIES;

  const lowerId = userId.toLowerCase();

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
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    
    // Seed appropriate demo entries for the persona
    if (lowerId.includes('kirana') || lowerId.includes('ramesh')) {
      localStorage.setItem(key, JSON.stringify(INITIAL_KIRANA_ENTRIES));
      return INITIAL_KIRANA_ENTRIES;
    }
    if (lowerId.includes('weaving') || lowerId.includes('lakshmi') || lowerId.includes('handloom')) {
      localStorage.setItem(key, JSON.stringify(INITIAL_WEAVING_ENTRIES));
      return INITIAL_WEAVING_ENTRIES;
    }
    // Default demo entries for anita or generic demo users
    localStorage.setItem(key, JSON.stringify(INITIAL_DEMO_ENTRIES));
    return INITIAL_DEMO_ENTRIES;
  }

  if (lowerId.includes('kirana') || lowerId.includes('ramesh')) {
    return INITIAL_KIRANA_ENTRIES;
  }
  if (lowerId.includes('weaving') || lowerId.includes('lakshmi')) {
    return INITIAL_WEAVING_ENTRIES;
  }
  return INITIAL_DEMO_ENTRIES;
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
