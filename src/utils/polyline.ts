// GOOGLE POLYLINE DECODER — clean TS version
export function decodePolyline(encoded: string) {
  let index = 0;
  const len = encoded.length;
  const path: { latitude: number; longitude: number }[] = [];

  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b,
      shift = 0,
      result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    path.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return path;
}
