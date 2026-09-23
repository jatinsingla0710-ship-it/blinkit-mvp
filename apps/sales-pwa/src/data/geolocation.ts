export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidCoordinatePair(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return (
    lat != null &&
    lng != null &&
    isValidLatitude(lat) &&
    isValidLongitude(lng)
  );
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export async function readCurrentPosition(options?: {
  timeoutMs?: number;
}): Promise<{ lat: number; lng: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported on this device.');
  }

  const timeoutMs = options?.timeoutMs ?? 15_000;

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
          reject(new Error('Received invalid coordinates from the device.'));
          return;
        }
        resolve({ lat, lng });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error(
                'Location permission was denied. Enable location access and try again.',
              ),
            );
            return;
          case error.POSITION_UNAVAILABLE:
            reject(
              new Error(
                'Current location is unavailable. Try again or capture coordinates later.',
              ),
            );
            return;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Try again.'));
            return;
          default:
            reject(new Error(error.message || 'Could not read current location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}
