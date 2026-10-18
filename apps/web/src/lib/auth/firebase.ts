/**
 * Firebase Auth — same project as glamonepal.com (env names match the
 * storefront). Google sign-in only; the ID token is the API Bearer.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, onIdTokenChanged, signInWithPopup, signOut, type Auth, type User } from "firebase/auth";

/** Public web config of the shared GLAMO Firebase project (not secret). Env vars override. */
const FALLBACK = {
  apiKey: "AIzaSyA13D6Q461WTxyWCN8-Qtv53rtvyH0quMw",
  authDomain: "www.glamonepal.com",
  projectId: "ankura-studio",
  storageBucket: "ankura-studio.firebasestorage.app",
  messagingSenderId: "935024312436",
  appId: "1:935024312436:web:c80b5723d95f775ac15121",
};

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || FALLBACK.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || FALLBACK.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FALLBACK.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || FALLBACK.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FALLBACK.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || FALLBACK.appId,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (typeof window === "undefined") throw new Error("Firebase Auth is browser-only");
  if (auth) return auth;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  return auth;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(firebaseAuth(), provider);
  return cred.user;
}

export async function signOutFirebase() {
  await signOut(firebaseAuth());
}

export function watchIdToken(cb: (user: User | null) => void) {
  return onIdTokenChanged(firebaseAuth(), cb);
}

export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const user = firebaseAuth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}
