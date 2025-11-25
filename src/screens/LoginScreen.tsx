import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState("");

  const handleContinue = () => {
    if (phone.length < 10) {
      alert("Enter a valid mobile number");
      return;
    }

    navigation.navigate("OTP", { phone });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Strata EV</Text>

      <Text style={styles.subtitle}>Enter your mobile number to continue</Text>

      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        placeholder="Mobile Number"
        placeholderTextColor="#999"
        value={phone}
        maxLength={10}
        onChangeText={setPhone}
      />

      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continue</Text>
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
