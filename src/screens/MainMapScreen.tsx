import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE, Marker, Region } from "react-native-maps";

import { fetchNearbyStations } from "../api/googlePlaces";

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MainMapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Track last fetch → so we don’t spam API on tiny moves
  const lastFetchRef = useRef<{
    lat: number;
    lng: number;
    radiusKm: number;
    ts: number;
  } | null>(null);

  const loadStations = useCallback(
    async (centerLat: number, centerLng: number, radiusKm: number) => {
      try {
        const radiusMeters = Math.round(radiusKm * 2000);
        const results = await fetchNearbyStations(
          centerLat,
          centerLng,
          radiusMeters
        );

        console.log(
          `🚗 Nearby EV Stations (center=${centerLat.toFixed(
            4
          )}, ${centerLng.toFixed(4)}, radius=${radiusKm.toFixed(2)}km):`,
          results
        );

        setStations(results);
        lastFetchRef.current = {
          lat: centerLat,
          lng: centerLng,
          radiusKm,
          ts: Date.now(),
        };
      } catch (err) {
        console.log("Stations fetch error:", err);
      }
    },
    []
  );

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

      // 2️⃣ Current location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("📍 User Location:", loc.coords);

      setLocation(loc.coords);

      const region: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setInitialRegion(region);

      // Use a reasonable default radius for first load
      const initialRadiusKm = 2.5;
      await loadStations(
        loc.coords.latitude,
        loc.coords.longitude,
        initialRadiusKm
      );

      setLoading(false);
    })();
  }, [loadStations]);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (!region) return;

      const centerLat = region.latitude;
      const centerLng = region.longitude;

      // Approximate radius from latitudeDelta (1° ≈ 111km)
      let radiusKm = (region.latitudeDelta * 111) / 2;

      // Clamp radius to avoid insane values
      if (radiusKm < 0.5) radiusKm = 0.5;
      if (radiusKm > 8) radiusKm = 8;

      const last = lastFetchRef.current;
      const now = Date.now();

      if (last) {
        const distMoved = haversineDistanceKm(
          centerLat,
          centerLng,
          last.lat,
          last.lng
        );
        const zoomDiff = Math.abs(radiusKm - last.radiusKm);
        const timeDiff = (now - last.ts) / 1000;

        // If user barely moved / zoomed and last fetch was recent, skip
        if (distMoved < 0.3 && zoomDiff < 0.3 && timeDiff < 2) {
          return;
        }
      }

      console.log(
        `🗺 Region changed → fetching stations. center=(${centerLat.toFixed(
          4
        )}, ${centerLng.toFixed(4)}), radius≈${radiusKm.toFixed(2)}km`
      );

      loadStations(centerLat, centerLng, radiusKm);
    },
    [loadStations]
  );

  if (loading || !initialRegion) {
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
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {/* EV Station markers */}
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
            {/* Temporary simple marker - we'll replace with charger icon next step */}
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
