import { describe, expect, it } from 'vitest';
import { downloadHref, isHls, pickLevels, stagesFor, timedOutLabel } from './media.js';
import { photosAnswer } from './journey.js';

const levels = [{ height: 1080 }, { height: 720 }, { height: 480 }];

describe('media helpers', () => {
  it('detects HLS urls', () => {
    expect(isHls('/a/master.m3u8')).toBe(true);
    expect(isHls('/a/master.m3u8?t=1')).toBe(true);
    expect(isHls('/a/video.mp4')).toBe(false);
  });
  it('download link needs a real file for HLS', () => {
    expect(downloadHref({ url: '/a/master.m3u8' })).toBeNull();
    expect(downloadHref({ url: '/a/master.m3u8', downloadUrl: '/a/o.mp4' })).toBe('/a/o.mp4');
    expect(downloadHref({ url: '/a/v.mp4' })).toBe('/a/v.mp4');
  });
  it('asks our media endpoint to save the original rather than show it', () => {
    expect(downloadHref({ url: '/api/media/abcDEF123_-xyz0123' })).toBe('/api/media/abcDEF123_-xyz0123?dl=1');
    expect(downloadHref({ url: 'https://api.example.test/api/media/abcDEF123_-xyz0123' })).toBe('https://api.example.test/api/media/abcDEF123_-xyz0123?dl=1');
    expect(downloadHref({ url: 'https://blob.example.test/c/o.jpg?sig=1' })).toBe('https://blob.example.test/c/o.jpg?sig=1');
  });
  it('loads thumbnail, then medium, then the original, skipping gaps and repeats', () => {
    expect(stagesFor({ previewUrl: '/t', mediumUrl: '/m', url: '/f' })).toEqual(['/t', '/m', '/f']);
    expect(stagesFor({ previewUrl: '/t', url: '/f' })).toEqual(['/t', '/f']);
    expect(stagesFor({ url: '/f' })).toEqual(['/f']);
    expect(stagesFor({ previewUrl: '/f', url: '/f' })).toEqual(['/f']);
  });
  it('starts at 720p on small screens, capped at 480p on poor connections', () => {
    expect(pickLevels(levels, { small: true, poor: false })).toEqual({ startLevel: 1, capLevel: -1 });
    expect(pickLevels(levels, { small: false, poor: true })).toEqual({ startLevel: 2, capLevel: 2 });
    expect(pickLevels(levels, { small: false, poor: false })).toEqual({ startLevel: -1, capLevel: -1 });
  });
});

describe('images that have timed out (UI-03)', () => {
  it('names each expired image for people who cannot see the placeholder', () => {
    expect(timedOutLabel(1, 3)).toBe('Image 2 of 3, timed out');
    expect(timedOutLabel(0, 1)).toBe('Image timed out');
  });
  it('the answer line only sends people to the images when they can be shown', () => {
    expect(photosAnswer({ hasVideo: false, timedOut: false })).toBe('Check the vehicle registration number and the vehicle in the images.');
    expect(photosAnswer({ hasVideo: true, timedOut: false })).toMatch(/images and video/);
    expect(photosAnswer({ hasVideo: true, timedOut: true })).toMatch(/Your images have timed out/);
    expect(photosAnswer({ hasVideo: false, timedOut: true })).not.toMatch(/Check the vehicle registration number/);
  });
});
