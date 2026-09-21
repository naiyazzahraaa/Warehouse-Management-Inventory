import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  memoryLocalCache,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  writeBatch,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance
export const firebaseApp = getApps().length > 0 
  ? getApp() 
  : initializeApp({
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
    });

// Force fetch directly from server without stale IndexedDB disk cache persistence
// This guarantees that Chrome, Safari, and other devices always share the exact same Firestore ground truth.
export const firestore: Firestore = (() => {
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || undefined;
    if (dbId) {
      return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() }, dbId);
    }
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  } catch {
    return getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || undefined);
  }
})();

export const COLLECTIONS = {
  ITEMS: 'items',
  TRANSACTIONS: 'transactions',
  SYSTEM: 'system_status',
} as const;

