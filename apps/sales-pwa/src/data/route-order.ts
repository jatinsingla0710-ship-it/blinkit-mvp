export type RoutePoint = {
  id: string;
  lat: number | null;
  lng: number | null;
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const lat1 = aLat * rad;
  const lat2 = bLat * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Nearest-neighbour order from the salesman. Stops without coordinates stay at the end. */
export function orderByNearest<T extends RoutePoint>(
  stops: T[],
  origin: { lat: number; lng: number } | null,
): T[] {
  const located = stops.filter((stop) => stop.lat != null && stop.lng != null);
  const missing = stops.filter((stop) => stop.lat == null || stop.lng == null);
  if (!origin || located.length === 0) return [...stops];
  const remaining = [...located];
  const ordered: T[] = [];
  let cursor = origin;
  while (remaining.length > 0) {
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const stop = remaining[index];
      const kilometres = distanceKm(cursor.lat, cursor.lng, stop.lat!, stop.lng!);
      if (kilometres < bestDistance) {
        bestDistance = kilometres;
        best = index;
      }
    }
    const next = remaining.splice(best, 1)[0];
    ordered.push(next);
    cursor = { lat: next.lat!, lng: next.lng! };
  }
  return [...ordered, ...missing];
}
