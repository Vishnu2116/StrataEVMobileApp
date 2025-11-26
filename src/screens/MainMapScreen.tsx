import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

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
        accuracy: Location.Accuracy.Balanced,
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
        <Text style={{ marginTop: 10 }}>Loading map...</Text>
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
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE} // Google Maps on Android, iOS requires API key later
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      />
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
});
