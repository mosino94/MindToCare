import { FirebaseOptions, initializeApp, getApp, getApps } from 'firebase/app';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCS_SnhYvjtL0jCJz_HHDLEwr42rPBAwqk",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mindtocare.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://studio-7147485763-c4a98-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-7147485763-c4a98",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-7147485763-c4a98.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "595272818909",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:595272818909:web:e2960258d9d8fb47ebbb34"
};

function initializeFirebase() {
    return !getApps().length ? initializeApp(firebaseConfig) : getApp();
}

export { firebaseConfig, initializeFirebase };
