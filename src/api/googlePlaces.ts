import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.mapsApiKey ||
  Constants.manifest?.extra?.mapsApiKey;

const EXCLUDE_TYPES = new Set([
  "locality",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "political",
]);

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

/**
 * Fetch one page of results
 */
async function fetchPage(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

/**
 * 🔥 Paginated text search → up to 60 results per area
 */
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

      if (delayNeeded) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const data = await fetchPage(pageUrl);
      const results = data.results || [];
      finalResults.push(...results);

      pageToken = data.next_page_token || null;
      delayNeeded = !!pageToken;
    } while (pageToken);

    // Filter out junk
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

    // Final formatting
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
