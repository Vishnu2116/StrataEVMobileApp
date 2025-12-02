import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import auth from "@react-native-firebase/auth";

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (phone.length < 10) {
      alert("Enter a valid 10-digit mobile number");
      return;
    }

    const fullPhone = "+91" + phone.trim();

    try {
      setLoading(true);
      console.log("📩 Sending OTP to:", fullPhone);

      // Native Firebase Phone Auth
      const confirmation = await auth().signInWithPhoneNumber(fullPhone);

      // Safer: pass only verificationId to the OTP screen (serializable)
      const verificationId = confirmation.verificationId;
      console.log("✅ Got verificationId:", verificationId);

      navigation.navigate("OTP", {
        phone: fullPhone,
        verificationId,
      });
    } catch (error: any) {
      console.log("❌ OTP Error:", error);

      if (error?.code === "auth/too-many-requests") {
        alert(
          "Too many OTP attempts from this device. Please wait some time or use a different device / test number."
        );
      } else {
        alert(error?.message || "Failed to send OTP. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Strata EV</Text>
      <Text style={styles.subtitle}>Enter your mobile number to continue</Text>

      <View style={styles.phoneContainer}>
        <Text style={styles.countryCode}>+91</Text>
        <View style={styles.divider} />
        <TextInput
          style={styles.inputFlex}
          keyboardType="phone-pad"
          placeholder="Mobile Number"
          placeholderTextColor="#999"
          value={phone}
          maxLength={10}
          onChangeText={setPhone}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading ? { opacity: 0.6 } : {}]}
        onPress={handleContinue}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Sending OTP..." : "Continue"}
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
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    height: 55,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  countryCode: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginRight: 8,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: "#ccc",
    marginRight: 8,
  },
  inputFlex: {
    flex: 1,
    fontSize: 18,
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
