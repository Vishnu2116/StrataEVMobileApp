import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.mapsApiKey ||
  Constants.manifest?.extra?.mapsApiKey;

// Types we *don't* want as “stations”
const EXCLUDE_TYPES = new Set([
  "locality",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "political",
]);

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

// 👉 Fetch nearby EV charging stations using Nearby Search API
export async function fetchNearbyStations(
  lat: number,
  lng: number,
  radius = 3000
) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("❌ GOOGLE_MAPS_API_KEY is missing");
    return [];
  }

  try {
    // Use keyword to bias results towards EV charging
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=ev+charging+station&key=${GOOGLE_MAPS_API_KEY}`;

    console.log("🔎 Fetching stations:", url);

    const response = await fetch(url);
    const data = await response.json();

    const results = data.results || [];

    // 🔍 Filter out obvious non-EV junk
    const filtered = results.filter((place: any) => {
      const types: string[] = place.types || [];

      // Must have valid coordinates
      const plLat = place.geometry?.location?.lat;
      const plLng = place.geometry?.location?.lng;
      if (typeof plLat !== "number" || typeof plLng !== "number") {
        return false;
      }

      // Exclude locality / administrative / political areas
      if (types.some((t) => EXCLUDE_TYPES.has(t))) {
        return false;
      }

      const name: string = place.name || "";

      const hasEvType = types.includes("electric_vehicle_charging_station");
      const isGasStation = types.includes("gas_station");
      const nameLooksLikeEv = /ev|charge|charging/i.test(name);

      // Keep:
      // - explicit EV charging stations
      // - gas stations returned in this EV search
      // - places whose names clearly indicate charging
      if (!hasEvType && !isGasStation && !nameLooksLikeEv) {
        return false;
      }

      return true;
    });

    const stations = filtered.map((place: any) => {
      const plLat = place.geometry.location.lat;
      const plLng = place.geometry.location.lng;

      const distanceKm = haversineDistanceKm(lat, lng, plLat, plLng);

      return {
        id: place.place_id,
        name: place.name,
        lat: plLat,
        lng: plLng,
        address: place.vicinity || "",
        rating: place.rating || 0,
        userRatingsTotal: place.user_ratings_total || 0,
        types: place.types || [],
        businessStatus: place.business_status || "",
        distanceKm,
      };
    });

    console.log("⚡ Stations found after filtering:", stations.length);

    return stations;
  } catch (err) {
    console.error("❌ Error fetching stations:", err);
    return [];
  }
}
