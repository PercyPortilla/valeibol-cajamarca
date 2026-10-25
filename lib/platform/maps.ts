export type MapLocation = {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
};

function validCoordinate(value: number | null, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function mapQuery(location: MapLocation) {
  if (validCoordinate(location.latitude, -90, 90) && validCoordinate(location.longitude, -180, 180)) {
    return `${location.latitude},${location.longitude}`;
  }
  const address = location.address?.trim();
  if (!address) return "";
  const city = location.city?.trim();
  return city ? `${address}, ${city}` : address;
}

export function googleMapsSearchHref(location: MapLocation) {
  const query = mapQuery(location);
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export function googleMapsEmbedHref(location: MapLocation) {
  const query = mapQuery(location);
  return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : null;
}
