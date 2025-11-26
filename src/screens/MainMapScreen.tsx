import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";

export default function MainMapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1️⃣ Ask for permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setErrorMsg("Location permission denied");
        setLoading(false);
        return;
      }

      // 2️⃣ Get current coordinates
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      console.log("📍 User Location:", loc.coords);

      setLocation(loc.coords);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A8754" />
        <Text style={{ marginTop: 10 }}>Getting your location...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.success}>Location Retrieved!</Text>
      <Text style={styles.coords}>Lat: {location.latitude.toFixed(6)}</Text>
      <Text style={styles.coords}>Lng: {location.longitude.toFixed(6)}</Text>
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
  error: {
    color: "red",
    fontSize: 18,
  },
  success: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
  },
  coords: {
    fontSize: 16,
    color: "#555",
    marginTop: 4,
  },
});
