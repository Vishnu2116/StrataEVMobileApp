import Constants from "expo-constants";
import { FirebaseOptions, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

// 1️⃣ Get Firebase config from app.json → extra.firebase
const firebaseConfig = Constants.expoConfig?.extra?.firebase as FirebaseOptions;

// 2️⃣ Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 3️⃣ Initialize Firebase Auth with persistent storage
let auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // If already initialized (hot reload), fallback
  auth = getAuth(app);
}

// 4️⃣ Initialize Firestore
const db = getFirestore(app);

// 5️⃣ Export everything we’ll need elsewhere
export { app, auth, db, firebaseConfig };
