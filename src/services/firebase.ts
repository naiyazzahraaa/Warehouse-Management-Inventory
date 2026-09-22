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

// Initialize Firestore with specific databaseId from config
export const firestore: Firestore = getFirestore(
  firebaseApp, 
  firebaseConfig.firestoreDatabaseId || undefined
);

export const COLLECTIONS = {
  ITEMS: 'items',
  TRANSACTIONS: 'transactions',
  SYSTEM: 'system_status',
} as const;

