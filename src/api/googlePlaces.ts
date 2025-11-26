import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.mapsApiKey ||
  Constants.manifest?.extra?.mapsApiKey;

// 👉 Fetch nearby EV charging stations using Nearby Search API
export async function fetchNearbyStations(
  lat: number,
  lng: number,
  radius = 3000
) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=electric_vehicle_charging_station&key=${GOOGLE_MAPS_API_KEY}`;

    console.log("🔎 Fetching stations:", url);

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results) {
      console.warn("No EV stations found.");
      return [];
    }

    // Simplify the objects we return to the app
    const stations = data.results.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
      address: place.vicinity || "",
      rating: place.rating || 0,
      types: place.types || [],
    }));

    console.log("⚡ Stations found:", stations.length);

    return stations;
  } catch (err) {
    console.error("❌ Error fetching stations:", err);
    return [];
  }
}
