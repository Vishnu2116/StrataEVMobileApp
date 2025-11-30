// src/screens/MainMapScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";

import { fetchNearbyStations } from "../api/googlePlaces";
import RouteInputCard from "../components/RouteInputCard";
import SearchLocationModal from "../components/SearchLocationModal";

// ------------------------------
// CONSTANTS
// ------------------------------
const GRID_ROWS = 3;
const GRID_COLS = 3;
const SEARCH_RADIUS_METERS = 1500;
const DEBOUNCE_MS = 800;
const MIN_FETCH_INTERVAL_MS = 3000;

// ------------------------------
// Types
// ------------------------------
type Station = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating: number;
  userRatingsTotal: number;
  businessStatus: string;
  types?: string[];
  distanceKm: number;
};

type SelectedLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

// ------------------------------
// Haversine
// ------------------------------
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------
// Build 3×3 grid
// ------------------------------
function getGridPointsFromRegion(region: any) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  const swLat = latitude - latitudeDelta / 2;
  const neLat = latitude + latitudeDelta / 2;
  const swLng = longitude - longitudeDelta / 2;
  const neLng = longitude + longitudeDelta / 2;

  const points: { lat: number; lng: number }[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    const lat = swLat + ((row + 0.5) / GRID_ROWS) * (neLat - swLat);

    for (let col = 0; col < GRID_COLS; col++) {
      const lng = swLng + ((col + 0.5) / GRID_COLS) * (neLng - swLng);
      points.push({ lat, lng });
    }
  }

  return points;
}

// ------------------------------
// MAIN
// ------------------------------
export default function MainMapScreen() {
  const insets = useSafeAreaInsets();

  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);

  const [initialRegion, setInitialRegion] = useState<any>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [startLabel, setStartLabel] = useState("Current Location");
  const [destinationLabel, setDestinationLabel] = useState("Enter destination");

  // Store chosen locations (will be used later for Directions API)
  const [startLocation, setStartLocation] = useState<SelectedLocation | null>(
    null
  );
  const [destinationLocation, setDestinationLocation] =
    useState<SelectedLocation | null>(null);

  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<"start" | "destination">(
    "start"
  );

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef(0);
  const lastRegionRef = useRef<any>(null);
  const originRef = useRef<{ latitude: number; longitude: number } | null>(
    null
  );

  // ------------------------------
  // Fetch stations for region
  // ------------------------------
  const loadStationsForRegion = useCallback(
    async (
      region: any,
      originCoords: { latitude: number; longitude: number }
    ) => {
      try {
        if (!region) return;

        const originLat = originCoords.latitude;
        const originLng = originCoords.longitude;

        const gridPoints = getGridPointsFromRegion(region);

        console.log(
          `⚡ Grid fetch: ${
            gridPoints.length
          } points, center=(${region.latitude.toFixed(
            4
          )}, ${region.longitude.toFixed(4)})`
        );

        const allResults = await Promise.all(
          gridPoints.map((p) =>
            fetchNearbyStations(p.lat, p.lng, SEARCH_RADIUS_METERS)
          )
        );

        const merged = new Map<string, Station>();

        allResults.forEach((list: any[]) => {
          (list || []).forEach((st: any) => {
            const newDist = haversineDistanceKm(
              originLat,
              originLng,
              st.lat,
              st.lng
            );

            const existing = merged.get(st.id);

            if (!existing || newDist < existing.distanceKm) {
              merged.set(st.id, { ...st, distanceKm: newDist });
            }
          });
        });

        const mergedStations = Array.from(merged.values()).sort(
          (a, b) => a.distanceKm - b.distanceKm
        );

        console.log(
          `⚡ Merged EV stations in viewport (unique): ${mergedStations.length}`
        );

        setStations(mergedStations);
        lastRegionRef.current = region;
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        console.log("❌ Grid error:", err);
      }
    },
    []
  );

  // ------------------------------
  // First load → location
  // ------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Location permission denied");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("📍 User Location:", loc.coords);

      setLocation(loc.coords);

      const region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setInitialRegion(region);

      originRef.current = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      await loadStationsForRegion(region, originRef.current);

      setLoading(false);
    })();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [loadStationsForRegion]);

  // ------------------------------
  // Region change
  // ------------------------------
  const handleRegionChangeComplete = useCallback(
    (region: any) => {
      if (!region) return;

      lastRegionRef.current = region;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        const now = Date.now();
        const since = now - lastFetchTimeRef.current;

        if (since < MIN_FETCH_INTERVAL_MS) {
          console.log(`⏱ Throttled: ${since}ms`);
          return;
        }

        const origin = originRef.current || {
          latitude: region.latitude,
          longitude: region.longitude,
        };

        console.log("🗺 Map settled");
        loadStationsForRegion(region, origin);
      }, DEBOUNCE_MS);
    },
    [loadStationsForRegion]
  );

  // ------------------------------
  // Route card clicks
  // ------------------------------
  const handlePressStart = () => {
    console.log("🟢 Start pressed");
    setSearchMode("start");
    setSearchModalVisible(true);
  };

  const handlePressDestination = () => {
    console.log("📍 Destination pressed");
    setSearchMode("destination");
    setSearchModalVisible(true);
  };

  const handlePressAdd = () => {
    console.log("➕ Add stop pressed");
    // Will be used later for saved places
  };

  const handleNavigatePress = () => {
    if (!selectedStation) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.lat},${selectedStation.lng}`;
    Linking.openURL(url);
  };

  // Callback from SearchLocationModal
  const handlePlaceSelected = (place: SelectedLocation) => {
    if (searchMode === "start") {
      console.log("✅ Selected start:", place);
      setStartLocation(place);
      setStartLabel(place.name || "Start location");
    } else {
      console.log("✅ Selected destination:", place);
      setDestinationLocation(place);
      setDestinationLabel(place.name || "Destination");
    }
  };

  // ------------------------------
  // Loading UI
  // ------------------------------
  if (loading || !initialRegion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A8754" />
        <Text style={{ marginTop: 10 }}>Loading map…</Text>
      </View>
    );
  }

  // ------------------------------
  // Error UI
  // ------------------------------
  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{errorMsg}</Text>
      </View>
    );
  }

  // ------------------------------
  // MAIN
  // ------------------------------
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {stations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{ latitude: station.lat, longitude: station.lng }}
            onPress={() => {
              console.log("📌 Marker pressed:", station.name);
              setSelectedStation(station);
            }}
          >
            <Image
              source={require("../../assets/icons/ev.png")}
              style={{ width: 44, height: 44 }}
              resizeMode="contain"
            />
          </Marker>
        ))}
      </MapView>

      {/* TOP OVERLAY with safe area padding */}
      <View
        style={[styles.topOverlay, { paddingTop: insets.top + 6 }]}
        pointerEvents="box-none"
      >
        <View style={styles.topRow}>
          <View style={styles.routeCardWrapper}>
            <RouteInputCard
              startLabel={startLabel}
              destinationLabel={destinationLabel}
              onPressStart={handlePressStart}
              onPressDestination={handlePressDestination}
              onPressAdd={handlePressAdd}
            />
          </View>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => console.log("⚙️ Filters button pressed")}
          >
            <Text style={styles.filterIcon}>☷</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Station bottom sheet */}
      {selectedStation && (
        <View style={styles.bottomSheetWrapper}>
          <View style={styles.bottomSheet}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedStation(null)}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>

            <Text style={styles.cardName}>{selectedStation.name}</Text>
            <Text style={styles.cardAddress}>{selectedStation.address}</Text>

            <View style={styles.rowBetween}>
              <Text style={styles.cardRating}>
                ⭐ {selectedStation.rating} ({selectedStation.userRatingsTotal})
              </Text>
              <Text style={styles.cardDistance}>
                {selectedStation.distanceKm.toFixed(1)} km
              </Text>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.badgeOpen}>
                <Text style={styles.badgeOpenText}>
                  {selectedStation.businessStatus === "OPERATIONAL"
                    ? "OPEN"
                    : "CLOSED"}
                </Text>
              </View>

              <View style={styles.badgeFast}>
                <Text style={styles.badgeFastText}>
                  {selectedStation.types?.includes(
                    "electric_vehicle_fast_charging"
                  )
                    ? "FAST CHARGER"
                    : "REGULAR"}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNavigatePress}
              >
                <Text style={styles.primaryBtnText}>Navigate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => console.log("Details:", selectedStation.name)}
              >
                <Text style={styles.secondaryBtnText}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Search modal */}
      <SearchLocationModal
        visible={searchModalVisible}
        mode={searchMode}
        originCoords={
          location
            ? { latitude: location.latitude, longitude: location.longitude }
            : null
        }
        onClose={() => setSearchModalVisible(false)}
        onPlaceSelected={handlePlaceSelected}
      />
    </View>
  );
}

// ------------------------------
// STYLES
// ------------------------------
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: "red", fontSize: 18 },

  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },

  topRow: { flexDirection: "row", alignItems: "flex-start" },

  routeCardWrapper: { flex: 1, marginRight: 8 },

  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  filterIcon: { fontSize: 20, color: "#222" },

  bottomSheetWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    alignItems: "center",
  },

  bottomSheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },

  closeBtn: {
    position: "absolute",
    right: 10,
    top: 8,
    width: 24,
    height: 24,
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  closeBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#444",
    marginTop: -1,
  },

  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
    paddingRight: 28,
  },
  cardAddress: {
    fontSize: 13,
    color: "#666",
    marginBottom: 10,
    lineHeight: 18,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardRating: { fontSize: 13, fontWeight: "600" },
  cardDistance: { fontSize: 13, fontWeight: "700", color: "#0A8754" },

  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },

  badgeOpen: {
    backgroundColor: "#E7F9ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOpenText: { color: "#0A8754", fontSize: 11, fontWeight: "700" },

  badgeFast: {
    backgroundColor: "#EAF4FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeFastText: { color: "#0A5CFF", fontSize: 11, fontWeight: "700" },

  buttonRow: { flexDirection: "row", justifyContent: "space-between" },

  primaryBtn: {
    backgroundColor: "#0A8754",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryBtnText: { color: "white", fontWeight: "700" },

  secondaryBtn: {
    backgroundColor: "#F1F1F1",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  secondaryBtnText: { color: "#444", fontWeight: "700" },
});
