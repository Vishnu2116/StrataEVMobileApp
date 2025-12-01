// src/api/savedPlaces.ts
import { db, auth } from "../api/firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { nanoid } from "nanoid/non-secure";

export type SavedPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: "home" | "work" | "custom";
  createdAt?: any;
};

// 🔐 Get reference to the correct Firestore path
function getUserCollection() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not logged in — cannot save places.");
  return collection(db, "users", uid, "saved_places");
}

// ⭐ Save place
export async function savePlace(place: Omit<SavedPlace, "id">) {
  const id = nanoid();
  const data = { ...place, id, createdAt: serverTimestamp() };

  const col = getUserCollection();
  const ref = doc(col, id);
  await setDoc(ref, data);

  return { id, ...place };
}

// ⭐ Get all saved places
export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const col = getUserCollection();
  const snap = await getDocs(col);

  const list: SavedPlace[] = [];
  snap.forEach((doc) => list.push(doc.data() as SavedPlace));
  return list.sort(
    (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
  );
}

// ⭐ Remove place
export async function removeSavedPlace(id: string) {
  const col = getUserCollection();
  const ref = doc(col, id);
  await deleteDoc(ref);
}
