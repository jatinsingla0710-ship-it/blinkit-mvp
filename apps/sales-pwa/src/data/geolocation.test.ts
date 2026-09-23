import { describe, expect, it } from 'vitest';
import {
  formatCoordinates,
  isValidCoordinatePair,
  isValidLatitude,
  isValidLongitude,
  readCurrentPosition,
} from './geolocation';

describe('sales geolocation helpers', () => {
  it('validates latitude and longitude ranges', () => {
    expect(isValidLatitude(28.6139)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLongitude(77.209)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
  });

  it('checks coordinate pairs', () => {
    expect(isValidCoordinatePair(28.6139, 77.209)).toBe(true);
    expect(isValidCoordinatePair(28.6139, null)).toBe(false);
    expect(isValidCoordinatePair(null, 77.209)).toBe(false);
  });

  it('formats coordinates', () => {
    expect(formatCoordinates(28.6139, 77.209)).toBe('28.613900, 77.209000');
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
});
