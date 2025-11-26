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
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import { fetchNearbyStations } from "../api/googlePlaces";

// ------------------------------
// CONSTANTS
// ------------------------------
const GRID_ROWS = 3;
const GRID_COLS = 3;
const SEARCH_RADIUS_METERS = 1500; // per-grid search radius
const DEBOUNCE_MS = 800; // wait after map settles
const MIN_FETCH_INTERVAL_MS = 3000; // hard throttle between fetches

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

// ------------------------------
// Haversine Distance Helper
// ------------------------------
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------
// Build 3×3 grid over current viewport
// ------------------------------
function getGridPointsFromRegion(region) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  const swLat = latitude - latitudeDelta / 2;
  const neLat = latitude + latitudeDelta / 2;
  const swLng = longitude - longitudeDelta / 2;
  const neLng = longitude + longitudeDelta / 2;

  const points = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    const lat = swLat + ((row + 0.5) / GRID_ROWS) * (neLat - swLat);

    for (let col = 0; col < GRID_COLS; col++) {
      const lng = swLng + ((col + 0.5) / GRID_COLS) * (neLng - swLng);
      points.push({ lat, lng });
    }
  }

  return points;
}

export default function MainMapScreen() {
  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [initialRegion, setInitialRegion] = useState<any>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef(0);
  const lastRegionRef = useRef<any>(null);
  const originRef = useRef<{ latitude: number; longitude: number } | null>(
    null
  );

  // ------------------------------
  // Grid-based fetch for a given region
  // ------------------------------
  const loadStationsForRegion = useCallback(async (region, originCoords) => {
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

      const mergedMap = new Map<string, Station>();

      allResults.forEach((list: any[]) => {
        (list || []).forEach((st: any) => {
          const newDistance = haversineDistanceKm(
            originLat,
            originLng,
            st.lat,
            st.lng
          );

          const existing = mergedMap.get(st.id);

          if (!existing) {
            mergedMap.set(st.id, {
              ...st,
              distanceKm: newDistance,
            });
          } else if (newDistance < existing.distanceKm) {
            mergedMap.set(st.id, {
              ...st,
              distanceKm: newDistance,
            });
          }
        });
      });

      const mergedStations = Array.from(mergedMap.values()).sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

      console.log(
        `⚡ Merged EV stations in viewport (unique): ${mergedStations.length}`
      );

      setStations(mergedStations);
      lastRegionRef.current = region;
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      console.log("❌ Grid stations fetch error:", err);
    }
  }, []);

  // ------------------------------
  // First Load → Get User Location
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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [loadStationsForRegion]);

  // ------------------------------
  // On Map Pan / Zoom → Debounced + Throttled Grid Fetch
  // ------------------------------
  const handleRegionChangeComplete = useCallback(
    (region) => {
      if (!region) return;

      lastRegionRef.current = region;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const now = Date.now();
        const sinceLast = now - lastFetchTimeRef.current;

        if (sinceLast < MIN_FETCH_INTERVAL_MS) {
          console.log(
            `⏱ Skipping fetch (throttled) – ${sinceLast}ms since last`
          );
          return;
        }

        const origin = originRef.current || {
          latitude: region.latitude,
          longitude: region.longitude,
        };

        console.log("🗺 Map settled → triggering grid fetch");
        loadStationsForRegion(region, origin);
      }, DEBOUNCE_MS);
    },
    [loadStationsForRegion]
  );

  // ------------------------------
  // LOADING UI
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
  // ERROR UI
  // ------------------------------
  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{errorMsg}</Text>
      </View>
    );
  }

  // ------------------------------
  // MAIN MAP + BOTTOM SHEET
  // ------------------------------
  const handleNavigatePress = () => {
    if (!selectedStation) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.lat},${selectedStation.lng}`;
    Linking.openURL(url).catch((err) =>
      console.log("Failed to open Google Maps:", err)
    );
  };

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
            <View>
              <Image
                source={require("../../assets/icons/ev.png")}
                style={{ width: 44, height: 44 }}
                resizeMode="contain"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Bottom Sliding Station Card */}
      {selectedStation && (
        <View style={styles.bottomSheetWrapper} pointerEvents="box-none">
          <View style={styles.bottomSheet}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedStation(null)}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>

            {/* TITLE */}
            <Text style={styles.cardName}>{selectedStation.name}</Text>

            {/* ADDRESS */}
            <Text style={styles.cardAddress}>{selectedStation.address}</Text>

            {/* RATING & DISTANCE */}
            <View style={styles.rowBetween}>
              <Text style={styles.cardRating}>
                ⭐ {selectedStation.rating} ({selectedStation.userRatingsTotal})
              </Text>
              <Text style={styles.cardDistance}>
                {selectedStation.distanceKm.toFixed(1)} km
              </Text>
            </View>

            {/* BADGES */}
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
                  {selectedStation.name.toLowerCase().includes("dc") ||
                  selectedStation.types?.includes(
                    "electric_vehicle_fast_charging"
                  )
                    ? "FAST CHARGER"
                    : "REGULAR"}
                </Text>
              </View>
            </View>

            {/* BUTTONS */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNavigatePress}
              >
                <Text style={styles.primaryBtnText}>Navigate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  // Placeholder for future "Details" screen
                  console.log("Details pressed:", selectedStation.name);
                }}
              >
                <Text style={styles.secondaryBtnText}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  error: {
    color: "red",
    fontSize: 18,
  },

  // BOTTOM SHEET WRAPPER
  bottomSheetWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12,
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#444",
    marginTop: -1,
  },

  // CARD TEXT
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    color: "#222",
    paddingRight: 28, // space for close button
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

  cardRating: {
    fontSize: 13,
    fontWeight: "600",
  },

  cardDistance: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A8754",
  },

  // BADGES
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  badgeOpen: {
    backgroundColor: "#E7F9ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOpenText: {
    color: "#0A8754",
    fontSize: 11,
    fontWeight: "700",
  },

  badgeFast: {
    backgroundColor: "#EAF4FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeFastText: {
    color: "#0A5CFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // BUTTONS
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  primaryBtn: {
    backgroundColor: "#0A8754",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "700",
  },

  secondaryBtn: {
    backgroundColor: "#F1F1F1",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: "#444",
    fontWeight: "700",
  },
});
