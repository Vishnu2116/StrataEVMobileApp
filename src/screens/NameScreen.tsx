import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export default function NameScreen({ route, navigation }: any) {
  const { uid } = route.params; // temp from Step 3.3
  const [name, setName] = useState("");

  const handleSave = () => {
    if (name.trim().length < 2) {
      alert("Enter a valid name");
      return;
    }

    // For now → simply navigate to Home (TabNavigator)
    // Firebase write happens in Step 3.6
    navigation.reset({
      index: 0,
      routes: [{ name: "Map" }], // load TabNavigator's Map screen
    });
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

      <TouchableOpacity style={styles.button} onPress={handleSave}>
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
