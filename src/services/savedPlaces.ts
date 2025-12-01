import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../api/firebase";

export type SavedPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: "home" | "work" | "custom";
};

export async function addSavedPlace(
  uid: string,
  place: Omit<SavedPlace, "id">
) {
  const colRef = collection(db, "users", uid, "saved_places");
  const newDoc = doc(colRef);

  await setDoc(newDoc, {
    ...place,
    createdAt: serverTimestamp(),
  });

  return newDoc.id;
}

export async function getSavedPlaces(uid: string): Promise<SavedPlace[]> {
  const colRef = collection(db, "users", uid, "saved_places");
  const snap = await getDocs(colRef);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      type: data.type,
    };
  });
}

export async function deleteSavedPlace(uid: string, id: string) {
  const ref = doc(db, "users", uid, "saved_places", id);
  await deleteDoc(ref);
}
