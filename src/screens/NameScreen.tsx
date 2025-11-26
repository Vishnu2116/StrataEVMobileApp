import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../api/firebase";

interface NameScreenProps {
  uid: string;
  phone?: string;
  onCompleted: () => void;
}

export default function NameScreen({
  uid,
  phone,
  onCompleted,
}: NameScreenProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (name.trim().length < 2) {
      alert("Enter a valid name");
      return;
    }

    try {
      setLoading(true);

      const userRef = doc(db, "users", uid);

      await setDoc(
        userRef,
        {
          name: name.trim(),
          phone: phone || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // we can later add savedLocations, etc.
        },
        { merge: true }
      );

      // 🔥 Tell AppNavigator that onboarding is done
      onCompleted();
    } catch (err: any) {
      console.log("Error saving user profile:", err);
      alert(err?.message || "Failed to save profile. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Name</Text>

      <Text style={styles.subtitle}>
        This helps personalize your experience
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity
        style={[styles.button, loading ? { opacity: 0.5 } : {}]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Saving..." : "Continue"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 24,
  },
  input: {
    height: 55,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 20,
    color: "#000",
  },
  button: {
    backgroundColor: "#0A8754",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
