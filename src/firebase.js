// Firebase: Google sign-in and the small cloud database that keeps a signed-in
// family's plans and check marks (see src/sync.js). Loaded only once someone
// signs in, so the app stays as light as before for everyone else.
// This config isn't a secret: it names the project, and the database rules
// (firestore.rules) are what keep each family's data to themselves.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { getFirestore, doc, runTransaction } from "firebase/firestore/lite";

const app = initializeApp({
    apiKey: "AIzaSyCWB9T5NXctuDjuflEsBZwFcM2rthY7mUw",
    authDomain: "family-worship-1689.firebaseapp.com",
    projectId: "family-worship-1689",
    storageBucket: "family-worship-1689.firebasestorage.app",
    messagingSenderId: "239201035121",
    appId: "1:239201035121:web:9bac399646d8d9c7abccd0",
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, doc, runTransaction };
