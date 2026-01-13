import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDxdTte9QzDdnK_LEdDAFpEodeONlFJuOM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "aaa-contract-department.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aaa-contract-department",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "aaa-contract-department.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "907957464792",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:907957464792:web:6e4cbfdd6b93b34496f1ad",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-2HBJH3D61R"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } else {
    app = getApps()[0];
    console.log('Using existing Firebase app');
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export { app, auth, db };
