import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { onAuthStateChanged, User } from "firebase/auth";

import { auth } from "../api/firebase";
import AuthNavigator from "./AuthNavigator";
import TabNavigator from "./TabNavigator";

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) return null;

  return user ? <TabNavigator /> : <AuthNavigator />;
}
