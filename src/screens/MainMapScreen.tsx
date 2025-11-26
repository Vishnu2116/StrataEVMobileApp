import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";

import { fetchNearbyStations } from "../api/googlePlaces";

export default function MainMapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1️⃣ Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Location permission denied");
        setLoading(false);
        return;
      }

      // 2️⃣ Get location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("📍 User Location:", loc.coords);
      setLocation(loc.coords);

      // 3️⃣ Fetch stations
      try {
        const results = await fetchNearbyStations(
          loc.coords.latitude,
          loc.coords.longitude
        );
        console.log("🚗 Nearby EV Stations:", results);
        setStations(results);
      } catch (err) {
        console.log("Stations fetch error:", err);
      }

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
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* 4️⃣ Render all EV station markers */}
        {stations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{
              latitude: station.lat,
              longitude: station.lng,
            }}
            title={station.name}
            description={station.address}
          >
            {/* Custom clean marker */}
            <View
              style={{
                width: 14,
                height: 14,
                backgroundColor: "#0A8754",
                borderRadius: 7,
                borderWidth: 2,
                borderColor: "white",
              }}
            />
          </Marker>
        ))}
      </MapView>
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
