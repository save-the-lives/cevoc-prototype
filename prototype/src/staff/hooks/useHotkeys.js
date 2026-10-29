import { useEffect, useRef, useSyncExternalStore } from 'react';

// Keyboard shortcuts for the staff workspace, designed to stay out of the browser's way.
//
// What we deliberately avoid:
//  - Browser and OS reserved combinations (Ctrl/Cmd+T, N, W, L, D, R, F, P, S, Tab, PageUp/Down, Alt+Arrows, F-keys).
//    Ctrl/Cmd+F in particular is never taken: find-in-page matters more than a shortcut.
//  - Keys that do something natively on the focused control: Enter and Space on links, buttons and checkboxes;
//    arrows inside menus, tabs, radios, sliders, selects and the column resize handle.
//  - Anything that needs Shift plus punctuation to work on every keyboard layout. "?" matches the typed character;
//    Ctrl+/ is an extra, with a button and menu item always available.
//
// Single-character shortcuts (j, k, x, a, f, o, p, g then r, ...) can be switched off, as WCAG 2.1.4 asks,
// because they clash with screen reader browse-mode keys and voice control. Arrow, Enter, Space-free named keys,
// Escape and Ctrl/Cmd combinations keep working when they are off.
//
// Keys are single characters ('j', '?', ' '), named keys ('ArrowDown'), two-key sequences ('g r'), or modifier
// combos ('mod+k', where mod is Ctrl on Windows/Linux and Cmd on macOS). A modifier handler can return false to
// leave the browser's own behaviour alone, for example Ctrl+A inside a text field.

const KEY = 'cevoc-single-keys';
const subs = new Set();
const read = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } };
export const singleKeysOn = read;
export function setSingleKeys(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ } subs.forEach((f) => f()); }
export const useSingleKeys = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read);

const typing = (t) => !!t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);
// Controls that use Enter or Space themselves.
const ACTIVATES = 'a[href],button,summary,[role="button"],[role="tab"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="checkbox"],[role="radio"],[role="switch"],[role="separator"],[role="combobox"]';
// Controls that use the arrow, Home, End and Page keys themselves, or regions marked as scrollable by keyboard.
const OWNS_ARROWS = '[role="menu"],[role="menuitem"],[role="tablist"],[role="tab"],[role="listbox"],[role="option"],[role="radio"],[role="radiogroup"],[role="slider"],[role="separator"],[role="combobox"],[data-keys="own"]';
const NAMED_NAV = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

export function useHotkeys(map, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return undefined;
    let seq = '';
    let timer;
    const on = (e) => {
      const m = ref.current;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.isComposing || e.repeat && k.length === 1 && !NAMED_NAV.has(k)) return;
      if (mod) {
        const fn = m[`mod+${k}`];
        if (fn) { if (fn(e) !== false) e.preventDefault(); }
        return;
      }
      if (e.altKey || typing(e.target) || document.querySelector('[role="dialog"]')) return;
      const t = e.target instanceof Element ? e.target : null;
      const named = k.length > 1;
      if (!named && !singleKeysOn()) { seq = ''; return; }
      if ((k === 'Enter' || k === ' ') && t?.closest(ACTIVATES)) return;
      if (NAMED_NAV.has(k) && t?.closest(OWNS_ARROWS)) return;
      const key = seq ? `${seq} ${k}` : k;
      clearTimeout(timer);
      if (m[key]) { seq = ''; e.preventDefault(); m[key](e); return; }
      if (!named && Object.keys(m).some((x) => x.startsWith(`${k} `)) && !seq) { seq = k; timer = setTimeout(() => { seq = ''; }, 900); return; }
      seq = '';
    };
    document.addEventListener('keydown', on);
    return () => { document.removeEventListener('keydown', on); clearTimeout(timer); };
  }, [enabled]);
}
