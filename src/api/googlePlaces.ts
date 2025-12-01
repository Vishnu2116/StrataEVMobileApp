import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.mapsApiKey ||
  Constants.manifest?.extra?.mapsApiKey;

// ❌ Types we don't want (junk / irrelevant)
const EXCLUDE_TYPES = new Set([
  "locality",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "political",
]);

// -------------------------------------------------------------
// 🌍 Haversine distance
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Fetch one page helper
// -------------------------------------------------------------
async function fetchPage(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// -------------------------------------------------------------
// 🔥 Paginated Place TextSearch (up to 60 results)
// -------------------------------------------------------------
export async function fetchNearbyStations(
  lat: number,
  lng: number,
  radius = 8000
) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("❌ GOOGLE_MAPS_API_KEY missing");
    return [];
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=ev+charging+station&location=${lat},${lng}&radius=${radius}&key=${GOOGLE_MAPS_API_KEY}`;

    const finalResults: any[] = [];
    let pageToken = null;
    let delayNeeded = false;

    do {
      let pageUrl = url;
      if (pageToken) {
        pageUrl = `${url}&pagetoken=${pageToken}`;
        delayNeeded = true;
      }

      // Google requires a delay for pagetoken
      if (delayNeeded) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const data = await fetchPage(pageUrl);
      const results = data.results || [];
      finalResults.push(...results);

      pageToken = data.next_page_token || null;
      delayNeeded = !!pageToken;
    } while (pageToken);

    // -------------------------------------------------------------
    // Filter out irrelevant locations
    // -------------------------------------------------------------
    const filtered = finalResults.filter((place) => {
      const types = place.types || [];

      const plLat = place.geometry?.location?.lat;
      const plLng = place.geometry?.location?.lng;
      if (!plLat || !plLng) return false;

      if (types.some((t) => EXCLUDE_TYPES.has(t))) return false;

      const name = place.name || "";

      const isEV = types.includes("electric_vehicle_charging_station");
      const isGas = types.includes("gas_station");
      const looksLikeEV = /ev|charge|charging/i.test(name);

      if (!isEV && !isGas && !looksLikeEV) return false;

      return true;
    });

    // -------------------------------------------------------------
    // Format final objects
    // -------------------------------------------------------------
    return filtered.map((place) => {
      const plLat = place.geometry.location.lat;
      const plLng = place.geometry.location.lng;

      return {
        id: place.place_id,
        name: place.name,
        lat: plLat,
        lng: plLng,
        address: place.formatted_address || place.vicinity || "",
        rating: place.rating || 0,
        userRatingsTotal: place.user_ratings_total || 0,
        businessStatus: place.business_status || "",
        types: place.types || [],
        distanceKm: haversineDistanceKm(lat, lng, plLat, plLng),
      };
    });
  } catch (err) {
    console.error("❌ Paginated fetch error:", err);
    return [];
  }
}

// -------------------------------------------------------------
// 📍 Polyline Decoder → Encoded polyline → LatLng[]
// -------------------------------------------------------------
export function decodePolyline(encoded: string) {
  if (!encoded) return [];

  let index = 0;
  const len = encoded.length;
  const path: { latitude: number; longitude: number }[] = [];

  let lat = 0;
  let lng = 0;

  while (index < len) {
    let result = 0;
    let shift = 0;
    let b;

    // Decode latitude
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Decode longitude
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    path.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return path;
}

// -------------------------------------------------------------
// 🚗 Directions API → Fetch polyline, distance & duration
// -------------------------------------------------------------
export async function fetchRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
) {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("❌ Missing Google Maps API key for Directions API");
      return null;
    }

    const base = "https://maps.googleapis.com/maps/api/directions/json";

    const params = new URLSearchParams({
      origin: `${startLat},${startLng}`,
      destination: `${destLat},${destLng}`,
      key: GOOGLE_MAPS_API_KEY,
      mode: "driving",
      alternatives: "false",
      units: "metric",
    });

    const url = `${base}?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      console.log("❌ Directions API error:", data.status, data.error_message);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      distanceText: leg.distance?.text || "",
      durationText: leg.duration?.text || "",
      polyline: route.overview_polyline?.points || "",
    };
  } catch (err) {
    console.error("❌ fetchRoute() failed:", err);
    return null;
  }
}
