import { describe, expect, it } from 'vitest';
import { orderByNearest } from './route-order';

describe('nearest route order', () => {
  it('visits the closer shop first and leaves shops without a location at the end', () => {
    const ordered = orderByNearest(
      [
        { id: 'far', lat: 19.2, lng: 72.9 },
        { id: 'near', lat: 19.01, lng: 72.81 },
        { id: 'none', lat: null, lng: null },
      ],
      { lat: 19, lng: 72.8 },
    );
    expect(ordered.map((stop) => stop.id)).toEqual(['near', 'far', 'none']);
  });

  it('keeps the given order when location is unavailable', () => {
    const stops = [
      { id: 'a', lat: 1, lng: 1 },
      { id: 'b', lat: 2, lng: 2 },
    ];
    expect(orderByNearest(stops, null).map((stop) => stop.id)).toEqual(['a', 'b']);
  });
});
