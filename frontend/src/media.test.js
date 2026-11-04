import { describe, expect, it } from 'vitest';
import { downloadHref, isHls, pickLevels, stagesFor } from './media.js';

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
