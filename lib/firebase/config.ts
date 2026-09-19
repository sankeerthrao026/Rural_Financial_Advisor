import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ruralcred-advisor.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ruralcred-advisor',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ruralcred-advisor.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

let firestoreInstance: Firestore | null = null;
let isFirebaseConfigured = false;

try {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    firestoreInstance = getFirestore(app);
    isFirebaseConfigured = true;
  }
} catch (error) {
  console.warn('Firebase initialization skipped, using resilient offline local storage:', error);
}

export { firestoreInstance, isFirebaseConfigured };
