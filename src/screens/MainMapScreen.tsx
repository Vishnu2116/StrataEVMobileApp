import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { auth, db } from "../api/firebase";

export default function MainMapScreen() {
  useEffect(() => {
    console.log("🔥 Firebase Auth Loaded:", auth);
    console.log("🔥 Firestore Loaded:", db);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Firebase Test Screen</Text>
    </View>
  );
}
