import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../api/firebase";
import AuthNavigator from "./AuthNavigator";
import TabNavigator from "./TabNavigator";
import NameScreen from "../screens/NameScreen";

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  // 🔐 Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return unsub;
  }, []);

  // 👤 Check if Firestore profile exists for this user
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setHasProfile(false);
        setProfileChecked(false);
        return;
      }

      setProfileChecked(false);

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        setHasProfile(snap.exists());
      } catch (err) {
        console.log("Error checking profile:", err);
        setHasProfile(false);
      } finally {
        setProfileChecked(true);
      }
    };

    checkProfile();
  }, [user]);

  // Loading state (auth or profile check)
  if (authLoading || (user && !profileChecked)) {
    return null; // you can replace with a splash/loading screen later
  }

  // 1️⃣ Not logged in → Auth flow
  if (!user) {
    return <AuthNavigator />;
  }

  // 2️⃣ Logged in but no profile → NameScreen (Onboarding)
  if (user && !hasProfile) {
    return (
      <NameScreen
        uid={user.uid}
        phone={user.phoneNumber || ""}
        onCompleted={() => setHasProfile(true)}
      />
    );
  }

  // 3️⃣ Logged in + profile exists → Main app
  return <TabNavigator />;
}
