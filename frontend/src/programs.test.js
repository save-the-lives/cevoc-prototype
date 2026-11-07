import { describe, expect, it } from 'vitest';
import { checkVersions, detailRows, pickMessage, pickProgram, pickVersion, resolveSwitches, videoView } from './programs.js';
import config from './programs.json';
import { applyEvent, eventsFromResult, initialLookup, toResult } from './lookupState.js';

// FICTITIOUS values only.
const redLight = (over = {}) => ({
  notice: { offenceDescription: 'Proceed through red traffic light', offenceDate: '2026-01-15', enforcementMethod: 'CAMERA' },
  details: { timeSinceRed: 1.2, speedLimit: 60 },
  ...over,
});

describe('program configuration file', () => {
  it('has no overlaps or gaps and every program has a version', () => {
    for (const p of config.programs) expect(checkVersions(p)).toEqual([]);
  });
  it('detects an overlap, a gap and two open ends', () => {
    const v = (version, from, to) => ({ version, from, to });
    expect(checkVersions({ id: 'X', versions: [v('a', '2024-01-01', '2024-06-30'), v('b', '2024-06-30', null)] }).join()).toContain('overlaps');
    expect(checkVersions({ id: 'X', versions: [v('a', '2024-01-01', '2024-06-30'), v('b', '2024-07-02', null)] }).join()).toContain('gap');
    expect(checkVersions({ id: 'X', versions: [v('a', '2024-01-01', null), v('b', '2024-07-01', null)] }).join()).toContain('no end');
  });
});

describe('picking the version by offence date', () => {
  const p = { id: 'X', versions: [{ version: 'a', from: '2024-01-01', to: '2024-06-30' }, { version: 'b', from: '2024-07-01', to: null }] };
  it('uses inclusive ends and the open-ended current version', () => {
    expect(pickVersion(p, '2024-01-01').version).toBe('a');
    expect(pickVersion(p, '2024-06-30').version).toBe('a');
    expect(pickVersion(p, '2024-07-01').version).toBe('b');
    expect(pickVersion(p, '2031-01-01').version).toBe('b');
    expect(pickVersion(p, '2023-12-31')).toBeNull();
    expect(pickVersion(p, 'not a date')).toBeNull();
  });
});

describe('red light details', () => {
  it('shows the two mockup facts with units, time since red first', () => {
    const v = detailRows(redLight());
    expect(v.state).toBe('rows');
    expect(v.rows).toEqual([
      { key: 'timeSinceRed', label: 'Seconds after the light turned red', first: true, value: '1.2 seconds' },
      { key: 'speedLimit', label: 'Speed limit', first: false, value: '60 km/h' },
    ]);
  });
  it('marks a missing or empty fact as missing (shown as a plain message), and ignores keys it does not show', () => {
    const v = detailRows(redLight({ details: { timeSinceRed: 2, speedLimit: '', lane: 2, direction: 'North' } }));
    expect(v.rows.map((r) => r.key)).toEqual(['timeSinceRed', 'speedLimit']);
    expect(v.rows.map((r) => !!r.missing)).toEqual([false, true]);
  });
  it('marks every configured fact missing when nothing was returned', () => {
    for (const details of [{}, undefined]) {
      const v = detailRows(redLight({ details }));
      expect(v.rows.map((r) => r.missing)).toEqual([true, true]);
    }
  });
  it('matches on a returned time since red when the summary text is different', () => {
    expect(pickProgram({ notice: { offenceDescription: 'Camera recorded' }, details: { timeSinceRed: 1 } }).id).toBe('RED_LIGHT_SPEED');
  });
  it('says so plainly when no version covers the offence date', () => {
    const v = detailRows(redLight({ notice: { offenceDescription: 'red light', offenceDate: '1990-01-01' } }));
    expect(v.state).toBe('no-version');
    expect(v.message).toMatch(/do not have display rules/);
  });
  it('is the default (nothing extra shown) for a notice that matches no program, and never throws on no details', () => {
    expect(detailRows({ notice: { offenceDescription: 'Parking offence', offenceDate: '2026-01-15' } }).state).toBe('default');
    expect(detailRows({ notice: null }).state).toBe('default');
    expect(detailRows(null).state).toBe('default');
  });
});

describe('the details map travels through the lookup state', () => {
  it('is applied from an extra event and appears in the result; absent otherwise', () => {
    let s = applyEvent(initialLookup(), 'details', { status: 'FOUND', notice: {} });
    expect(toResult(s).details).toBeUndefined();
    s = applyEvent(s, 'extra', { details: { lane: '2' } });
    expect(toResult(s).details).toEqual({ lane: '2' });
    expect(applyEvent(s, 'extra', { details: 'not a map' })).toBe(s);
  });
  it('a single JSON answer with details is equivalent to an extra event', () => {
    const names = eventsFromResult({ status: 'FOUND', evidence: [], certificates: [], details: { lane: '2' } }).map((e) => e[0]);
    expect(names).toContain('extra');
    expect(eventsFromResult({ status: 'FOUND', evidence: [], certificates: [] }).map((e) => e[0])).not.toContain('extra');
  });
});

// FICTITIOUS notices only (9000000004, camera 7109).
describe('default block and switch inheritance', () => {
  const cfgWith = (types) => ({
    ...config,
    programs: [{ ...config.programs[0], versions: [{ ...config.programs[0].versions[0], types }] }],
  });
  const video = { kind: 'VIDEO', title: 'Sample video', url: '/samples/video-1.mp4' };
  const rl = (evidence) => ({ ...redLight(), infringementNumber: '9000000004', evidence });
  const unknown = (evidence) => ({ infringementNumber: '9000000004', notice: { offenceDescription: 'Unlisted offence TST123', offenceDate: '2026-01-15', enforcementMethod: 'CAMERA' }, evidence });

  it('has a default block that loads, has no version problems and sets video on', () => {
    expect(config.default.id).toBe('DEFAULT');
    expect(checkVersions(config.default)).toEqual([]);
    expect(resolveSwitches(unknown([])).types.video.mode).toBe('on');
  });
  it('program sets video off: nothing is rendered even if a video is returned, and the plain message shows', () => {
    const cfg = cfgWith({ video: { mode: 'off' } });
    expect(videoView(rl([video]), cfg)).toEqual({ render: false, message: 'Video is not available for this program.' });
  });
  it('program sets video not applicable with its own wording: that wording wins', () => {
    const cfg = cfgWith({ video: { mode: 'not_applicable', message: 'There is no video for this offence.' } });
    expect(videoView(rl([video]), cfg)).toEqual({ render: false, message: 'There is no video for this offence.' });
  });
  it('program silent on video: inherits the default (on). Plays when returned, says so plainly when not', () => {
    const cfg = cfgWith({ images: { mode: 'on' } });
    expect(videoView(rl([video]), cfg)).toEqual({ render: true, message: null });
    const none = videoView(rl([]), cfg);
    expect(none.render).toBe(false);
    expect(none.message).toMatch(/not available yet/);
  });
  it('program sets video on: it plays when returned and says so plainly when none is returned', () => {
    const cfg = cfgWith({ video: { mode: 'on', messageNone: 'No video has been returned for this notice.' } });
    expect(videoView(rl([video]), cfg).render).toBe(true);
    expect(videoView(rl([]), cfg).message).toBe('No video has been returned for this notice.');
  });
  it('every switch is inherited when the program is silent, and a program switch wins', () => {
    const silent = resolveSwitches(rl([]), cfgWith({}));
    expect(Object.keys(silent.types).sort()).toEqual(['certificates', 'evidence_pack', 'images', 'messages', 'video']);
    expect(silent.types.messages.mode).toBe('on');
    const own = resolveSwitches(rl([]), cfgWith({ certificates: { mode: 'off' }, messages: { mode: 'off' } }));
    expect(own.types.certificates.mode).toBe('off');
    expect(own.types.messages.mode).toBe('off');
    expect(own.types.images.mode).toBe('on');
  });
  it('an unknown program falls to the default block: its switches, a visible message, no error', () => {
    const r = unknown([video]);
    expect(resolveSwitches(r).source).toBe('default');
    expect(videoView(r).render).toBe(true);
    const view = detailRows(r);
    expect(view.state).toBe('default');
    expect(view.message).toMatch(/not available yet/);
  });
  it('a known program with no version for the offence date also uses the default block switches', () => {
    const r = { ...redLight({ notice: { offenceDescription: 'red light', offenceDate: '1990-01-01' } }), evidence: [] };
    expect(resolveSwitches(r).source).toBe('default');
  });
  it('pickMessage returns the highest-priority matching message', () => {
    // timeSinceRed 4 matches both >3 (pri 1) and >1 (pri 2); pri 1 wins
    const r = redLight({ details: { timeSinceRed: 4, speedLimit: 60 } });
    const msg = pickMessage(r);
    expect(msg.priority).toBe(1);
    expect(msg.text).toMatch(/three seconds/);
  });
  it('pickMessage returns a lower-priority message when the top rule does not match', () => {
    const r = redLight({ details: { timeSinceRed: 2, speedLimit: 60 } });
    const msg = pickMessage(r);
    expect(msg.priority).toBe(2);
    expect(msg.text).toMatch(/more than a second/);
  });
  it('pickMessage returns null when no rule matches', () => {
    const r = redLight({ details: { timeSinceRed: 0.5, speedLimit: 60 } });
    expect(pickMessage(r)).toBeNull();
  });
  it('pickMessage returns null when the messages switch is off', () => {
    const cfg = cfgWith({ messages: { mode: 'off' } });
    const r = redLight({ details: { timeSinceRed: 4, speedLimit: 60 } });
    expect(pickMessage(r, cfg)).toBeNull();
  });
  it('pickMessage falls back to default messages for an unknown program', () => {
    const r = { notice: { offenceDescription: 'Unknown offence', offenceDate: '2026-01-15' }, details: { speedKmh: 50, speedOverLimit: 15 } };
    const msg = pickMessage(r);
    expect(msg).not.toBeNull();
    expect(msg.text).toMatch(/risk of serious injury/);
  });
  it('pickMessage never throws on null input', () => {
    expect(pickMessage(null)).toBeNull();
    expect(pickMessage(undefined)).toBeNull();
  });
  it('the red light page behaves the same when its own block is missing', () => {
    const cfg = { ...config, programs: [] };
    expect(detailRows(redLight(), cfg).state).toBe('default');
    expect(videoView(rl([video]), cfg).render).toBe(true);
  });
  it('never throws on a missing result', () => {
    expect(videoView(null).render).toBe(false);
    expect(resolveSwitches(undefined).source).toBe('default');
  });
});
