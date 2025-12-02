import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import auth from "@react-native-firebase/auth";

export default function OTPScreen({ route, navigation }: any) {
  const { phone, confirmation } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length < 6) {
      alert("Enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);

      const credential = await confirmation.confirm(code);
      console.log("✅ OTP Verified! User:", credential.user?.uid);

      // Redirect to main app
      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch (err: any) {
      console.log("❌ OTP Verification Error:", err);
      alert(err?.message || "Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>OTP sent to {phone}</Text>

      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder="Enter 6-digit OTP"
        placeholderTextColor="#999"
        value={code}
        onChangeText={setCode}
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.button, loading ? { opacity: 0.5 } : {}]}
        onPress={handleVerify}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Verifying..." : "Continue"}
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
    fontSize: 20,
    letterSpacing: 4,
    textAlign: "center",
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
