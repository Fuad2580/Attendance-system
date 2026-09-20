import { LocationMaster, AppConfig } from '../types';

/**
 * Calculates distance between two GPS coordinates using the Haversine Formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance);
}

export interface NearestLocationResult {
  location: LocationMaster | null;
  distance: number;
  allowedRadius: number;
  isWithinRadius: boolean;
}

/**
 * Iterates through all active locations in LOCATION_MASTER and returns the nearest one,
 * along with the calculated distance and radius validation based on CONFIG or location override.
 */
export function findNearestLocation(
  userLat: number,
  userLon: number,
  locations: LocationMaster[],
  config: AppConfig
): NearestLocationResult {
  const activeLocations = locations.filter((loc) => loc.status === 'ACTIVE');

  if (activeLocations.length === 0) {
    return {
      location: null,
      distance: 0,
      allowedRadius: config.attendanceRadiusMeter,
      isWithinRadius: false,
    };
  }

  let nearest: LocationMaster | null = null;
  let minDistance = Infinity;

  for (const loc of activeLocations) {
    const dist = calculateHaversineDistance(userLat, userLon, loc.latitude, loc.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  }

  const allowedRadius =
    nearest && nearest.radiusMeter && nearest.radiusMeter > 0
      ? nearest.radiusMeter
      : config.attendanceRadiusMeter;

  return {
    location: nearest,
    distance: minDistance === Infinity ? 0 : minDistance,
    allowedRadius,
    isWithinRadius: minDistance <= allowedRadius,
  };
}
