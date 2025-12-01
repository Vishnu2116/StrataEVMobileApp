// src/screens/MainMapScreen.tsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from "react-native-maps";

import { fetchNearbyStations, fetchRoute } from "../api/googlePlaces";
import { decodePolyline } from "../utils/polyline";

import RouteInputCard from "../components/RouteInputCard";
import SearchLocationModal from "../components/SearchLocationModal";
import SavedPlacesModal from "../components/SavedPlacesModal";

import {
  getSavedPlaces,
  savePlace,
  removeSavedPlace,
  SavedPlace,
} from "../services/savedPlaces";

// ------------------------------------
const GRID_ROWS = 3;
const GRID_COLS = 3;
const SEARCH_RADIUS_METERS = 1500;
const DEBOUNCE_MS = 800;
const MIN_FETCH_INTERVAL_MS = 3000;

// ------------------------------------
type Station = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating: number;
  userRatingsTotal: number;
  businessStatus: string;
  distanceKm: number;
};

type SelectedLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

// ------------------------------------
// DISTANCE HELPERS
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lat2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distancePointToSegment(p, a, b) {
  const EPS = 1e-6;

  const A = { lat: a.latitude, lng: a.longitude };
  const B = { lat: b.latitude, lng: b.longitude };
  const P = { lat: p.lat, lng: p.lng };

  const ABx = B.lng - A.lng;
  const ABy = B.lat - A.lat;
  const APx = P.lng - A.lng;
  const APy = P.lat - A.lat;

  const mag = ABx * ABx + ABy * ABy;
  let t = (APx * ABx + APy * ABy) / (mag + EPS);
  t = Math.max(0, Math.min(1, t));

  const proj = {
    lat: A.lat + t * ABy,
    lng: A.lng + t * ABx,
  };

  const R = 6371e3;
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(P.lat - proj.lat);
  const dLon = toRad(P.lng - proj.lng);

  const a2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(P.lat)) *
      Math.cos(toRad(proj.lat)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

// ------------------------------------
// CACHING HELPERS
// Cache based on viewport bounds (Option 1)
function makeRegionKey(region: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  const minLat = latitude - latitudeDelta / 2;
  const maxLat = latitude + latitudeDelta / 2;
  const minLng = longitude - longitudeDelta / 2;
  const maxLng = longitude + longitudeDelta / 2;

  // round for stability
  return [
    minLat.toFixed(3),
    maxLat.toFixed(3),
    minLng.toFixed(3),
    maxLng.toFixed(3),
  ].join("_");
}

// ------------------------------------
// MEMOIZED POLYLINE (avoid iOS disappearing bug)
const RoutePolyline = React.memo(function RoutePolyline({
  coords,
}: {
  coords: { latitude: number; longitude: number }[];
}) {
  if (!coords || coords.length === 0) return null;

  return (
    <Polyline
      coordinates={coords}
      strokeColor="#0A5CFF"
      strokeWidth={6}
      // optionally: lineCap="round"
      // optionally: lineJoin="round"
    />
  );
});

// ------------------------------------
export default function MainMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Modes
  const [stationMode, setStationMode] = useState<
    "normal" | "routing" | "route-only"
  >("normal");

  // Location
  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [initialRegion, setInitialRegion] = useState<any>(null);

  // EV stations
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Routing
  const [routeCoords, setRouteCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [stationsAlongRoute, setStationsAlongRoute] = useState<Station[]>([]);
  const [showRouteStationsCard, setShowRouteStationsCard] = useState(false);
  const [focusedRouteStation, setFocusedRouteStation] =
    useState<Station | null>(null);

  // Labels / Selection
  const [loading, setLoading] = useState(true);
  const [startLabel, setStartLabel] = useState("Current Location");
  const [destinationLabel, setDestinationLabel] = useState("Enter destination");

  const [startLocation, setStartLocation] = useState<SelectedLocation | null>(
    null
  );
  const [destinationLocation, setDestinationLocation] =
    useState<SelectedLocation | null>(null);

  // Search modal
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<"start" | "destination">(
    "start"
  );

  // Saved places
  const [savedModalVisible, setSavedModalVisible] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [savedSelectionMode, setSavedSelectionMode] = useState<
    "start" | "destination"
  >("start");

  // Debounce refs
  const debounceTimerRef = useRef<any>(null);
  const lastFetchTimeRef = useRef(0);
  const originRef = useRef<any>(null);

  // Skip fetch when we programmatically change region
  const skipFetchRef = useRef<boolean>(false);

  // In-memory cache of stations per region
  const stationsCacheRef = useRef<Map<string, Station[]>>(
    new Map<string, Station[]>()
  );

  // ------------------------------------
  // SAFE LOAD SAVED PLACES
  const loadSavedPlaces = async () => {
    try {
      const list = await getSavedPlaces();
      setSavedPlaces(list || []);
    } catch (e) {
      console.log("⚠️ Skipping saved places load:", e);
    }
  };

  // ------------------------------------
  // DELETE SAVED PLACE
  const handleDeleteSavedPlace = async (id: string) => {
    try {
      await removeSavedPlace(id);
      await loadSavedPlaces();
    } catch (e) {
      console.log("Delete saved place error:", e);
    }
  };

  // ------------------------------------
  // SAVE STATION (with duplicate check)
  const handleSaveStation = async (place: any) => {
    try {
      const exists = savedPlaces.some(
        (p) =>
          Math.abs(p.lat - place.lat) < 0.0001 &&
          Math.abs(p.lng - place.lng) < 0.0001
      );

      if (exists) {
        alert("Already saved");
        return;
      }

      const type = place.name.toLowerCase().includes("home")
        ? "home"
        : place.name.toLowerCase().includes("work")
        ? "work"
        : "custom";

      await savePlace({
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        type,
      });

      alert("Saved!");
      loadSavedPlaces();
    } catch (err) {
      console.log("❌ Save error:", err);
      alert("Failed to save");
    }
  };

  // ------------------------------------
  // GRID SEARCH
  function getGridPointsFromRegion(region) {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

    const swLat = latitude - latitudeDelta / 2;
    const neLat = latitude + latitudeDelta / 2;
    const swLng = longitude - longitudeDelta / 2;
    const neLng = longitude + longitudeDelta / 2;

    const points = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const lat = swLat + ((r + 0.5) / GRID_ROWS) * (neLat - swLat);
      for (let c = 0; c < GRID_COLS; c++) {
        const lng = swLng + ((c + 0.5) / GRID_COLS) * (neLng - swLng);
        points.push({ lat, lng });
      }
    }
    return points;
  }

  const loadStationsForRegion = useCallback(
    async (region, originCoords) => {
      if (stationMode !== "normal") return;

      const cacheKey = makeRegionKey(region);
      const cache = stationsCacheRef.current;

      // 1. Try cache first
      if (cache.has(cacheKey)) {
        // console.log("📦 Using cached stations for region", cacheKey);
        setStations(cache.get(cacheKey) || []);
        return;
      }

      const originLat = originCoords.latitude;
      const originLng = originCoords.longitude;

      const gridPoints = getGridPointsFromRegion(region);

      let allResults;
      try {
        allResults = await Promise.all(
          gridPoints.map((p) =>
            fetchNearbyStations(p.lat, p.lng, SEARCH_RADIUS_METERS)
          )
        );
      } catch (err) {
        console.log("❌ Error fetching stations:", err);
        return;
      }

      const merged = new Map<string, Station>();

      allResults.forEach((list) => {
        list.forEach((st) => {
          const d = haversineDistanceKm(originLat, originLng, st.lat, st.lng);
          const existing = merged.get(st.id);
          if (!existing || d < existing.distanceKm) {
            merged.set(st.id, { ...st, distanceKm: d });
          }
        });
      });

      const mergedList = Array.from(merged.values());

      // 2. Store in cache
      cache.set(cacheKey, mergedList);

      // 3. Update state
      setStations(mergedList);
    },
    [stationMode]
  );

  // ------------------------------------
  // INITIAL LOCATION
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
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

        await loadSavedPlaces();

        setLoading(false);
      } catch (err) {
        console.log("Init error:", err);
        setLoading(false);
      }
    })();
  }, [loadStationsForRegion]);

  // ------------------------------------
  // SET START LOCATION TO CURRENT POSITION
  useEffect(() => {
    if (location && !startLocation) {
      setStartLocation({
        name: "Current Location",
        address: "",
        lat: location.latitude,
        lng: location.longitude,
      });
    }
  }, [location, startLocation]);

  // ------------------------------------
  // REGION CHANGE
  const handleRegionChangeComplete = useCallback(
    (region) => {
      if (skipFetchRef.current) {
        // console.log("⏭ Skipping fetch due to programmatic zoom");
        return;
      }

      if (!region || stationMode !== "normal") return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        const now = Date.now();
        if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) return;

        const origin = originRef.current || {
          latitude: region.latitude,
          longitude: region.longitude,
        };

        loadStationsForRegion(region, origin);
        lastFetchTimeRef.current = Date.now();
      }, DEBOUNCE_MS);
    },
    [loadStationsForRegion, stationMode]
  );

  // ------------------------------------
  // ROUTE CALCULATION
  const handleFetchRoute = async () => {
    if (!startLocation || !destinationLocation) return;

    setStationMode("routing");

    const result = await fetchRoute(
      startLocation.lat,
      startLocation.lng,
      destinationLocation.lat,
      destinationLocation.lng
    );

    if (!result?.polyline) {
      alert("Route not found");
      return;
    }

    const decoded = decodePolyline(result.polyline);
    // Ensure decoded is in { latitude, longitude } format
    setRouteCoords(decoded);
    setRouteDistance(result.distanceText);
    setRouteDuration(result.durationText);

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(decoded, {
        edgePadding: { top: 80, bottom: 260, left: 60, right: 60 },
        animated: true,
      });
    }, 300);
  };

  useEffect(() => {
    if (startLocation && destinationLocation) {
      handleFetchRoute();
    }
  }, [startLocation, destinationLocation]);

  // ------------------------------------
  // CLEAR ROUTE
  const clearRoute = () => {
    setStationMode("normal");
    setRouteCoords([]);
    setRouteDistance("");
    setRouteDuration("");

    setDestinationLocation(null);
    setDestinationLabel("Enter destination");

    setStationsAlongRoute([]);
    setFocusedRouteStation(null);
    setShowRouteStationsCard(false);

    if (initialRegion) {
      mapRef.current?.animateToRegion(initialRegion, 500);
    }
  };

  // ------------------------------------
  // FIND STATIONS ALONG ROUTE
  const findStationsAlongRoute = () => {
    const MAX_DIST = 300;

    const results = stations.filter((s) => {
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const d = distancePointToSegment(s, routeCoords[i], routeCoords[i + 1]);
        if (d <= MAX_DIST) return true;
      }
      return false;
    });

    setStationsAlongRoute(results);
    setFocusedRouteStation(null);
    setStationMode("route-only");
    setShowRouteStationsCard(true);
  };

  // ------------------------------------
  const handlePlaceSelected = (place) => {
    if (searchMode === "start") {
      setStartLocation(place);
      setStartLabel(place.name);
    } else {
      setDestinationLocation(place);
      setDestinationLabel(place.name);
    }
  };

  const zoomToStation = (station: Station) => {
    skipFetchRef.current = true;

    mapRef.current?.animateToRegion(
      {
        latitude: station.lat,
        longitude: station.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      500
    );

    setTimeout(() => {
      skipFetchRef.current = false;
    }, 800);
  };

  // Special zoom for "Stations On Route" → keep full route visible
  const zoomToStationOnRoute = (station: Station) => {
    if (!routeCoords || routeCoords.length === 0) {
      zoomToStation(station);
      return;
    }

    const allCoords = [
      ...routeCoords,
      { latitude: station.lat, longitude: station.lng },
    ];

    skipFetchRef.current = true;

    mapRef.current?.fitToCoordinates(allCoords, {
      edgePadding: { top: 80, bottom: 260, left: 60, right: 60 },
      animated: true,
    });

    setTimeout(() => {
      skipFetchRef.current = false;
    }, 800);
  };

  // ------------------------------------
  // MEMOIZED ROUTE COORDS FOR POLYLINE
  const memoRouteCoords = useMemo(() => routeCoords, [routeCoords]);

  // ------------------------------------
  // LOADING UI
  if (loading || !initialRegion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading…</Text>
      </View>
    );
  }

  // ------------------------------------
  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {/* Start marker */}
        {startLocation && (
          <Marker
            coordinate={{
              latitude: startLocation.lat,
              longitude: startLocation.lng,
            }}
            pinColor="green"
          />
        )}

        {/* Destination marker */}
        {destinationLocation && (
          <Marker
            coordinate={{
              latitude: destinationLocation.lat,
              longitude: destinationLocation.lng,
            }}
            pinColor="blue"
          />
        )}

        {/* Normal mode markers */}
        {stationMode === "normal" &&
          stations.map((st) => {
            const isSelected = selectedStation?.id === st.id;

            return (
              <Marker
                key={st.id}
                coordinate={{ latitude: st.lat, longitude: st.lng }}
                onPress={() => {
                  setSelectedStation(st);
                }}
              >
                <Image
                  source={require("../../assets/icons/ev.png")}
                  style={{
                    width: isSelected ? 48 : 40,
                    height: isSelected ? 48 : 40,
                  }}
                  resizeMode="contain"
                />
              </Marker>
            );
          })}

        {/* Route-only markers (keep marker even when focused) */}
        {stationMode === "route-only" &&
          stationsAlongRoute.map((st) => (
            <Marker
              key={st.id}
              coordinate={{ latitude: st.lat, longitude: st.lng }}
              onPress={() => setFocusedRouteStation(st)}
            >
              <Image
                source={require("../../assets/icons/ev.png")}
                style={{ width: 44, height: 44 }}
                resizeMode="contain"
              />
            </Marker>
          ))}

        {/* Route polyline — stays as long as routeCoords not cleared */}
        <RoutePolyline coords={memoRouteCoords} />
      </MapView>

      {/* SEARCH CARD */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 6 }]}>
        <RouteInputCard
          startLabel={startLabel}
          destinationLabel={destinationLabel}
          onPressStart={() => {
            setSearchMode("start");
            setSearchModalVisible(true);
          }}
          onPressDestination={() => {
            setSearchMode("destination");
            setSearchModalVisible(true);
          }}
          onPressSaved={() => {
            setSavedSelectionMode(searchMode);
            setSavedModalVisible(true);
            loadSavedPlaces();
          }}
        />
      </View>

      {/* ROUTE PREVIEW */}
      {routeCoords.length > 0 && (
        <View style={styles.routePreviewWrapper}>
          <View style={styles.routePreviewCard}>
            <Text style={styles.routeInfoText}>
              {routeDistance} • {routeDuration}
            </Text>

            <View style={styles.routeButtonsRow}>
              <TouchableOpacity
                style={styles.routeBtnPrimary}
                onPress={findStationsAlongRoute}
              >
                <Text style={styles.routeBtnPrimaryText}>
                  Stations On Route
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.routeBtnSecondary}
                onPress={clearRoute}
              >
                <Text style={styles.routeBtnSecondaryText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* SHEET — STATIONS ALONG ROUTE */}
      {showRouteStationsCard && (
        <View style={styles.fullSheet}>
          <Text style={styles.sheetTitle}>Stations Along Route</Text>

          <FlatList
            data={stationsAlongRoute}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  zoomToStationOnRoute(item);
                  setFocusedRouteStation(item);
                }}
              >
                <View style={styles.stationItem}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemAddress}>{item.address}</Text>
                  <Text style={styles.itemRating}>
                    ⭐ {item.rating} ({item.userRatingsTotal})
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={styles.sheetCloseBtn}
            onPress={() => {
              setShowRouteStationsCard(false);
              setStationMode("routing");
            }}
          >
            <Text style={styles.sheetCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ROUTE-ONLY DETAIL CARD */}
      {focusedRouteStation && stationMode === "route-only" && (
        <View style={styles.stationDetailCard}>
          <Text style={styles.detailTitle}>{focusedRouteStation.name}</Text>
          <Text style={styles.detailAddress}>
            {focusedRouteStation.address}
          </Text>
          <Text style={styles.detailRating}>
            ⭐ {focusedRouteStation.rating} (
            {focusedRouteStation.userRatingsTotal})
          </Text>

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            {/* NAVIGATE */}
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${focusedRouteStation.lat},${focusedRouteStation.lng}`;
                Linking.openURL(url);
              }}
            >
              <Text style={styles.navigateText}>Navigate</Text>
            </TouchableOpacity>

            {/* SAVE */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => handleSaveStation(focusedRouteStation)}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>

            {/* CLOSE */}
            <TouchableOpacity
              style={styles.closeDetailBtn}
              onPress={() => setFocusedRouteStation(null)}
            >
              <Text style={styles.closeDetailText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* NORMAL MODE DETAIL CARD */}
      {selectedStation && stationMode === "normal" && (
        <View style={styles.normalStationCard}>
          <Text style={styles.detailTitle}>{selectedStation.name}</Text>
          <Text style={styles.detailAddress}>{selectedStation.address}</Text>
          <Text style={styles.detailRating}>
            ⭐ {selectedStation.rating} ({selectedStation.userRatingsTotal})
          </Text>

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.lat},${selectedStation.lng}`;
                Linking.openURL(url);
              }}
            >
              <Text style={styles.navigateText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => handleSaveStation(selectedStation)}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeDetailBtn}
              onPress={() => setSelectedStation(null)}
            >
              <Text style={styles.closeDetailText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SEARCH MODAL */}
      <SearchLocationModal
        visible={searchModalVisible}
        mode={searchMode}
        originCoords={
          location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
              }
            : null
        }
        onClose={() => setSearchModalVisible(false)}
        onPlaceSelected={handlePlaceSelected}
      />

      {/* SAVED PLACES MODAL */}
      <SavedPlacesModal
        visible={savedModalVisible}
        places={savedPlaces}
        onClose={() => setSavedModalVisible(false)}
        onDelete={handleDeleteSavedPlace}
        onSelect={(place) => {
          setSavedModalVisible(false);

          // Build a synthetic Station from SavedPlace so marker is guaranteed
          const stationFromPlace: Station = {
            id: place.id,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            rating: 0,
            userRatingsTotal: 0,
            businessStatus: "OPERATIONAL",
            distanceKm: 0,
          };

          // Ensure it's present in stations list so marker renders
          setStations((prev) => {
            const exists = prev.some((st) => st.id === stationFromPlace.id);
            if (exists) return prev;
            return [...prev, stationFromPlace];
          });

          // Zoom to saved place (no extra fetch due to skipFetchRef)
          zoomToStation(stationFromPlace);

          // Open details card
          setSelectedStation(stationFromPlace);
        }}
      />
    </View>
  );
}

// ------------------------------------
// STYLES
// ------------------------------------
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  topOverlay: {
    position: "absolute",
    top: 0,
    width: "100%",
    paddingHorizontal: 12,
  },

  routePreviewWrapper: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: "center",
    zIndex: 20,
  },
  routePreviewCard: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  routeInfoText: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  routeButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  routeBtnPrimary: {
    flex: 1,
    backgroundColor: "#0A5CFF",
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    alignItems: "center",
  },
  routeBtnPrimaryText: { color: "#fff", fontWeight: "700" },
  routeBtnSecondary: {
    width: 80,
    backgroundColor: "#eee",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  routeBtnSecondaryText: { fontWeight: "700", color: "#333" },

  fullSheet: {
    position: "absolute",
    bottom: 5,
    left: 10,
    right: 10,
    height: "35%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  stationItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  itemAddress: { fontSize: 12, color: "#666" },
  itemRating: { fontSize: 12, color: "#444", marginTop: 4 },
  sheetCloseBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  sheetCloseText: {
    fontWeight: "700",
    color: "#333",
  },

  stationDetailCard: {
    position: "absolute",
    bottom: 145,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },

  detailTitle: { fontSize: 16, fontWeight: "700" },
  detailAddress: { fontSize: 13, color: "#666", marginTop: 4 },
  detailRating: { marginTop: 6, color: "#333" },

  navigateBtn: {
    flex: 1,
    backgroundColor: "#0A5CFF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },
  navigateText: { color: "#fff", fontWeight: "700" },

  saveBtn: {
    width: 70,
    backgroundColor: "#FFB300",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  saveText: { fontWeight: "700", color: "#222" },

  closeDetailBtn: {
    width: 80,
    backgroundColor: "#eee",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeDetailText: { fontWeight: "700", color: "#333" },

  normalStationCard: {
    position: "absolute",
    bottom: 145,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
});
