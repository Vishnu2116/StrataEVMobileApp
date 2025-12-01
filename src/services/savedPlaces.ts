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

// ------------------------------------------------------------
// 🛡 SAFE: Get Firestore path only if user is logged in
// ------------------------------------------------------------
function getUserCollection() {
  const uid = auth.currentUser?.uid;

  // prevent app freeze / infinite loading
  if (!uid) {
    console.log("⚠️ No user logged in — skipping saved places ops");
    return null;
  }

  return collection(db, "users", uid, "saved_places");
}

// ------------------------------------------------------------
// ⭐ Save a place (SAFE)
// ------------------------------------------------------------
export async function savePlace(place: Omit<SavedPlace, "id">) {
  const col = getUserCollection();
  if (!col) return null; // user not logged in

  const id = nanoid();
  const data = {
    ...place,
    id,
    createdAt: serverTimestamp(),
  };

  try {
    const ref = doc(col, id);
    await setDoc(ref, data);
    return { id, ...place };
  } catch (err) {
    console.log("❌ Firestore savePlace error:", err);
    return null;
  }
}

// ------------------------------------------------------------
// ⭐ Get all saved places (SAFE)
// ------------------------------------------------------------
export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const col = getUserCollection();
  if (!col) return []; // no user → return empty list safely

  try {
    const snap = await getDocs(col);
    const list: SavedPlace[] = [];

    snap.forEach((doc) => {
      const data = doc.data();

      // prevent app crash if data is malformed
      if (!data || !data.id) return;

      list.push(data as SavedPlace);
    });

    return list.sort(
      (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    );
  } catch (err) {
    console.log("❌ Firestore getSavedPlaces error:", err);
    return [];
  }
}

// ------------------------------------------------------------
// ⭐ Remove saved place (SAFE)
// ------------------------------------------------------------
export async function removeSavedPlace(id: string) {
  const col = getUserCollection();
  if (!col) return;

  try {
    const ref = doc(col, id);
    await deleteDoc(ref);
  } catch (err) {
    console.log("❌ Firestore removeSavedPlace error:", err);
  }
}
