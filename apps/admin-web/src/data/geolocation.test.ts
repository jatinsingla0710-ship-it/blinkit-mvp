import { describe, expect, it } from 'vitest';
import {
  buildGoogleMapsDirectionsUrl,
  formatCoordinates,
  isValidCoordinatePair,
  isValidLatitude,
  isValidLongitude,
  readCurrentPosition,
} from './geolocation';

describe('geolocation helpers', () => {
  it('validates latitude and longitude ranges', () => {
    expect(isValidLatitude(28.6139)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);

    expect(isValidLongitude(77.209)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
  });

  it('checks coordinate pairs', () => {
    expect(isValidCoordinatePair(28.6139, 77.209)).toBe(true);
    expect(isValidCoordinatePair(28.6139, null)).toBe(false);
    expect(isValidCoordinatePair(null, 77.209)).toBe(false);
    expect(isValidCoordinatePair(200, 77.209)).toBe(false);
  });

  it('formats coordinates and builds maps URL', () => {
    expect(formatCoordinates(28.6139, 77.209)).toBe('28.613900, 77.209000');
    expect(buildGoogleMapsDirectionsUrl(28.6139, 77.209)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=28.6139%2C77.209',
    );
  });

  it('reads geolocation successfully', async () => {
    const getCurrentPosition = (
      success: PositionCallback,
      _error?: PositionErrorCallback | null,
    ) => {
      success({
        coords: {
          latitude: 28.6139,
          longitude: 77.209,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition } },
      configurable: true,
    });

    await expect(readCurrentPosition()).resolves.toEqual({
      lat: 28.6139,
      lng: 77.209,
    });
  });

  it('surfaces permission denied errors', async () => {
    const getCurrentPosition = (
      _success: PositionCallback,
      error?: PositionErrorCallback | null,
    ) => {
      error?.({
        code: 1,
        message: 'Permission denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition } },
      configurable: true,
    });

    await expect(readCurrentPosition()).rejects.toThrow(/permission was denied/i);
  });

  it('rejects invalid coordinates from the browser', async () => {
    const getCurrentPosition = (
      success: PositionCallback,
      _error?: PositionErrorCallback | null,
    ) => {
      success({
        coords: {
          latitude: 181,
          longitude: 77.209,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition } },
      configurable: true,
    });

    await expect(readCurrentPosition()).rejects.toThrow(/invalid coordinates/i);
  });
});
