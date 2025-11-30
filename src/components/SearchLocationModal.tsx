// src/components/SearchLocationModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.mapsApiKey ||
  Constants.manifest?.extra?.mapsApiKey;

type SearchLocationModalProps = {
  visible: boolean;
  mode: "start" | "destination";
  onClose: () => void;
  onPlaceSelected: (place: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  }) => void;
  originCoords?: { latitude: number; longitude: number } | null;
};

type Prediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
};

const SearchLocationModal: React.FC<SearchLocationModalProps> = ({
  visible,
  mode,
  onClose,
  onPlaceSelected,
  originCoords,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens / closes
  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      setError(null);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [visible]);

  const fetchAutocomplete = useCallback(
    async (text: string) => {
      if (!GOOGLE_MAPS_API_KEY) {
        setError("Missing Google Maps API key");
        return;
      }

      if (!text.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const base =
          "https://maps.googleapis.com/maps/api/place/autocomplete/json";

        const params = new URLSearchParams({
          input: text,
          key: GOOGLE_MAPS_API_KEY,
          language: "en",
          types: "geocode",
        });

        if (originCoords) {
          params.append(
            "location",
            `${originCoords.latitude},${originCoords.longitude}`
          );
          params.append("radius", "20000"); // 20km bias
        }

        const url = `${base}?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          console.log("Autocomplete status:", data.status, data.error_message);
        }

        setResults(data.predictions || []);
      } catch (err) {
        console.log("Autocomplete fetch error:", err);
        setError("Failed to search. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [originCoords]
  );

  const handleChangeText = (text: string) => {
    setQuery(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchAutocomplete(text);
    }, 400);
  };

  const fetchPlaceDetails = useCallback(
    async (prediction: Prediction) => {
      if (!GOOGLE_MAPS_API_KEY) return;

      try {
        setLoading(true);
        setError(null);

        const base = "https://maps.googleapis.com/maps/api/place/details/json";

        const params = new URLSearchParams({
          place_id: prediction.place_id,
          key: GOOGLE_MAPS_API_KEY,
          fields: "formatted_address,name,geometry",
        });

        const url = `${base}?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK") {
          console.log("Place details status:", data.status, data.error_message);
          setError("Could not fetch place details.");
          return;
        }

        const detail = data.result;
        const loc = detail.geometry?.location;

        if (!loc) {
          setError("Location not found for this place.");
          return;
        }

        const place = {
          name:
            detail.name || prediction.structured_formatting?.main_text || "",
          address: detail.formatted_address || prediction.description || "",
          lat: loc.lat,
          lng: loc.lng,
        };

        onPlaceSelected(place);
        Keyboard.dismiss();
        onClose();
      } catch (err) {
        console.log("Place details error:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [onClose, onPlaceSelected]
  );

  const renderItem = ({ item }: { item: Prediction }) => {
    const main = item.structured_formatting?.main_text || item.description;
    const secondary = item.structured_formatting?.secondary_text;

    return (
      <TouchableOpacity
        style={styles.resultRow}
        onPress={() => fetchPlaceDetails(item)}
      >
        <View style={styles.resultIconCircle}>
          <Text style={styles.resultIconLetter}>📍</Text>
        </View>
        <View style={styles.resultTextWrapper}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {main}
          </Text>
          <Text style={styles.resultSubtitle} numberOfLines={2}>
            {secondary || item.description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const title =
    mode === "start" ? "Choose starting point" : "Enter destination";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Search input */}
        <View style={styles.searchWrapper}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={handleChangeText}
            placeholder="Search for a place"
            placeholderTextColor="#999"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {/* Status / error */}
        {error && (
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        )}

        {/* Results */}
        {loading && results.length === 0 ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#0A5CFF" />
            <Text style={styles.loadingText}>Searching…</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              results.length === 0 ? styles.emptyList : undefined
            }
            ListEmptyComponent={
              !loading && query.length > 0 ? (
                <Text style={styles.emptyText}>No results found</Text>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
};

export default SearchLocationModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 52, // simple safe-ish top padding
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  backText: {
    fontSize: 24,
    lineHeight: 24,
    color: "#222",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  searchWrapper: {
    marginBottom: 10,
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F9F9F9",
    fontSize: 14,
    color: "#111",
  },
  errorText: {
    color: "#D11A2A",
    fontSize: 12,
    marginBottom: 6,
  },
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#555",
  },
  resultRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  resultIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EAF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  resultIconLetter: {
    fontSize: 16,
    color: "#0A5CFF",
  },
  resultTextWrapper: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 12,
    color: "#777",
  },
  emptyList: {
    paddingTop: 24,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    color: "#777",
  },
});
