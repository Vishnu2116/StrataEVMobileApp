import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { TabParamList } from "../navigation/TabNavigator";
import { auth, db } from "../api/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

type Props = BottomTabScreenProps<TabParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) return;

      try {
        const ref = doc(db, "users", currentUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setName(snap.data().name || null);
        }
      } catch (err) {
        console.log("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // AppNavigator will automatically switch to AuthNavigator
    } catch (err) {
      console.log("Logout error:", err);
      alert("Failed to logout. Try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{name || "Not available"}</Text>

        <Text style={[styles.label, { marginTop: 20 }]}>Mobile</Text>
        <Text style={styles.value}>{currentUser?.phoneNumber}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 32,
    color: "#000",
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#f5f5f5",
    padding: 20,
    borderRadius: 16,
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: "#888",
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    color: "#000",
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#D9534F",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
