package cevoc.adapter.out.scraper.live;

import com.microsoft.playwright.Frame;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Structure-only diagnostics for where the banner text lives on the page. Finds out WHICH frame holds banner label words,
 * what kind of element carries them (tag and class tokens), whether the text is selectable, whether it sits over the large image,
 * and whether any text response carries the labels as fields. It reports label NAMES from a fixed vocabulary, counts, tags, class
 * tokens and yes/no; it never returns any page text or any value.
 */
final class BannerLayerProbe {

    private BannerLayerProbe() {}

    /** Fixed vocabulary of label words that identify a banner. */
    static final String[] LABELS = {"camera code", "time since red", "speed limit", "yellow light", "incident number", "lane", "direction",
            "operator", "offence"};

    /** Key-name tokens (letters only, lower case) that identify a banner field in a JSON response. */
    private static final String[] KEY_TOKENS = {"timesincered", "speedlimit", "cameracode", "yellowlight", "incidentnumber", "banner",
            "redlight", "operator", "laneno", "lanenumber"};

    private static final Pattern JSON_KEY = Pattern.compile("\"([A-Za-z_][A-Za-z0-9_]{1,40})\"\\s*:");

    /** Runs in every frame. Returns a compact JSON string with structure only. */
    private static final String JS = """
            () => {
              const STRONG = ['camera code','time since red','speed limit','yellow light','incident number'];
              const WEAK = ['lane','direction','operator','offence'];
              const names = new Set();
              function match(t) {
                const found = [];
                if (!t) return found;
                const l = String(t).toLowerCase().replace(/\\s+/g, ' ');
                for (const w of STRONG) if (l.includes(w)) found.push(w.replace(/ /g, '-'));
                for (const w of WEAK) if (new RegExp('(^|[^a-z])' + w + ' ?:').test(l)) found.push(w);
                return found;
              }
              function cls(el) {
                const raw = typeof el.className === 'string' ? el.className : ((el.className && el.className.baseVal) || '');
                return raw.split(/\\s+/).filter(c => c && c.length <= 24 && !/\\d{3,}/.test(c)).slice(0, 3)
                  .map(c => c.replace(/[^A-Za-z0-9_-]/g, '')).join('.');
              }
              function shape(el) { return el.tagName.toLowerCase() + (cls(el) ? '.' + cls(el) : ''); }
              const imgs = Array.from(document.images);
              let big = null, bigArea = 0;
              for (const im of imgs) { const r = im.getBoundingClientRect(); if (r.width * r.height > bigArea) { bigArea = r.width * r.height; big = im; } }
              const ir = big ? big.getBoundingClientRect() : null;
              const hits = new Map();
              const attrHits = new Set();
              const stats = { shadow: 0, svgText: 0, canvas: 0, iframe: 0, elements: 0 };
              function visit(root, inShadow) {
                for (const el of root.querySelectorAll('*')) {
                  stats.elements++;
                  const tag = el.tagName.toLowerCase();
                  if (tag === 'canvas') stats.canvas++;
                  if (tag === 'iframe') stats.iframe++;
                  if (tag === 'text' || tag === 'tspan') stats.svgText++;
                  if (el.shadowRoot) { stats.shadow++; visit(el.shadowRoot, true); }
                  for (const a of el.attributes) {
                    if (a.name !== 'class' && a.name !== 'style' && a.value && a.value.length < 3000 && match(a.value).length) {
                      attrHits.add(a.name.replace(/[^A-Za-z-]/g, '').slice(0, 24));
                    }
                  }
                  let own = '';
                  for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue + ' ';
                  const f = match(own);
                  if (!f.length) continue;
                  f.forEach(x => names.add(x));
                  let selectable = false;
                  try {
                    const s = window.getSelection();
                    const r = document.createRange();
                    r.selectNodeContents(el);
                    s.removeAllRanges();
                    s.addRange(r);
                    selectable = s.toString().length > 0;
                    s.removeAllRanges();
                  } catch (e) { selectable = false; }
                  const cs = getComputedStyle(el);
                  const rect = el.getBoundingClientRect();
                  const over = !!ir && rect.width > 0 && rect.height > 0 && rect.left < ir.right && rect.right > ir.left
                    && rect.top < ir.bottom && rect.bottom > ir.top;
                  const par = el.parentElement ? shape(el.parentElement) : 'none';
                  const key = shape(el) + '<' + par + '|pos:' + cs.position + '|sel:' + (selectable ? 'y' : 'n') + '|us:' + cs.userSelect
                    + '|shadow:' + (inShadow ? 'y' : 'n') + '|svg:' + (el.closest && el.closest('svg') ? 'y' : 'n')
                    + '|over:' + (over ? 'y' : 'n') + '|vis:' + (cs.visibility === 'hidden' || cs.display === 'none' ? 'n' : 'y')
                    + '|op:' + (parseFloat(cs.opacity) === 0 ? '0' : 'ok') + '|col:' + (cs.color === 'rgba(0, 0, 0, 0)' ? 'clear' : 'set');
                  hits.set(key, (hits.get(key) || 0) + 1);
                }
              }
              visit(document, false);
              let bodyText = '';
              try { bodyText = document.body ? document.body.innerText : ''; } catch (e) { bodyText = ''; }
              match(bodyText).forEach(x => names.add('t:' + x));
              let stack = [];
              if (ir) {
                try {
                  const cx = Math.min(Math.max(ir.left + ir.width / 2, 0), innerWidth - 1);
                  const cy = Math.min(Math.max(ir.top + ir.height * 0.9, 0), innerHeight - 1);
                  stack = document.elementsFromPoint(cx, cy).slice(0, 6).map(shape);
                } catch (e) { stack = []; }
              }
              const CTRL = ['enlarge','zoom','expand','full','download','print','rotate','close','next','prev','back','view','image','photo','detail','info','more','text','caption','overlay','banner','share','open','magnif'];
              const ctrls = new Map();
              for (const el of document.querySelectorAll('button,a,[role=button],[role=dialog],[role=img],input,[tabindex]')) {
                const hay = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.textContent || '').slice(0, 60)
                  + ' ' + (el.id || '') + ' ' + cls(el)).toLowerCase();
                const h = CTRL.filter(w => hay.includes(w));
                if (!h.length) continue;
                const k = shape(el) + ':' + h.join('+');
                ctrls.set(k, (ctrls.get(k) || 0) + 1);
              }
              const frames = Array.from(document.querySelectorAll('iframe')).map(f => {
                const src = f.getAttribute('src') || '';
                const r = f.getBoundingClientRect();
                return shape(f) + '|src:' + (!src ? 'none' : src.startsWith('about') ? 'about' : src.startsWith('blob:') ? 'blob' : src.startsWith('data:') ? 'data'
                  : src.startsWith('http') ? 'http' : 'rel') + '|srcdoc:' + (f.hasAttribute('srcdoc') ? 'y' : 'n') + '|sandbox:' + (f.hasAttribute('sandbox') ? 'y' : 'n')
                  + '|noscript:' + (f.closest('noscript') ? 'y' : 'n') + '|size:' + Math.round(r.width) + 'x' + Math.round(r.height);
              });
              const ovl = Array.from(document.querySelectorAll('[role=dialog],[class*=modal],[class*=lightbox],[class*=overlay],[class*=viewer],[class*=zoom],[class*=popup]'))
                .slice(0, 8).map(el => shape(el) + '|txt:' + ((el.innerText || '').length === 0 ? '0' : (el.innerText || '').length < 100 ? 'lt100' : 'ge100')
                  + '|vis:' + (el.getBoundingClientRect().width > 0 ? 'y' : 'n'));
              const grid = new Set();
              if (ir) {
                for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.95]) {
                  try {
                    const e = document.elementsFromPoint(Math.min(Math.max(ir.left + ir.width * fx, 0), innerWidth - 1), Math.min(Math.max(ir.top + ir.height * fy, 0), innerHeight - 1))[0];
                    if (e) grid.add(shape(e));
                  } catch (e2) { /* ignore */ }
                }
              }
              const pseudo = [];
              if (big) {
                let anc = big; const scope = [];
                for (let i = 0; i < 6 && anc; i++, anc = anc.parentElement) { scope.push(anc); for (const c of anc.children) scope.push(c); }
                for (const el of scope.slice(0, 80)) for (const ps of ['::before', '::after']) {
                  const c = getComputedStyle(el, ps).content;
                  if (c && c !== 'none' && c !== 'normal' && c !== '""' && pseudo.length < 4) pseudo.push(shape(el) + ps);
                }
              }
              const tree = [];
              function walkTree(el, depth) {
                if (tree.length >= 40 || depth > 6) return;
                const own = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.nodeValue.trim()).reduce((t, n) => t + n.nodeValue.trim().length, 0);
                const cs = getComputedStyle(el);
                tree.push(depth + ':' + shape(el) + '(c' + el.children.length + ',own' + (own === 0 ? '0' : own < 20 ? 'S' : own < 100 ? 'M' : 'L') + ',pos:' + cs.position
                  + (el.shadowRoot ? ',shadow' : '') + ')');
                for (const c of el.children) walkTree(c, depth + 1);
              }
              for (const m of document.querySelectorAll('modal.zoom-image-modal, .zoom-image-modal')) { walkTree(m, 0); break; }
              const texts = new Map();
              const scopeRoots = [];
              for (const m of document.querySelectorAll('.zoom-image-modal, fine-image')) scopeRoots.push(m);
              function bucket(n) { return n === 0 ? '0' : n < 10 ? 'XS' : n < 30 ? 'S' : n < 100 ? 'M' : 'L'; }
              function scanTexts(el, where) {
                for (const e of el.querySelectorAll('*')) {
                  let own = '';
                  for (const n of e.childNodes) if (n.nodeType === 3) own += n.nodeValue + ' ';
                  own = own.trim();
                  if (own.length < 3) continue;
                  const cs = getComputedStyle(e);
                  const colons = (own.match(/:/g) || []).length;
                  const digits = (own.match(/[0-9]/g) || []).length;
                  const key = where + ':' + shape(e) + '|len:' + bucket(own.length) + '|words:' + Math.min(own.split(/\s+/).length, 30) + '|colons:' + Math.min(colons, 9)
                    + '|digits:' + bucket(digits) + '|pos:' + cs.position;
                  texts.set(key, (texts.get(key) || 0) + 1);
                }
              }
              scopeRoots.forEach(r => scanTexts(r, 'scope'));
              for (const e of document.querySelectorAll('body *')) {
                let own = '';
                for (const n of e.childNodes) if (n.nodeType === 3) own += n.nodeValue + ' ';
                own = own.trim();
                const colons = (own.match(/:/g) || []).length;
                const cs = getComputedStyle(e);
                if (own.length >= 3 && (colons >= 2 || cs.position === 'absolute' || cs.position === 'fixed') && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE') {
                  const key = 'any:' + shape(e) + '|len:' + bucket(own.length) + '|words:' + Math.min(own.split(/\s+/).length, 30) + '|colons:' + Math.min(colons, 9) + '|pos:' + cs.position;
                  texts.set(key, (texts.get(key) || 0) + 1);
                }
              }
              const imgAttrs = Array.from(document.images).slice(0, 6).map(im => ['alt', 'title', 'aria-label'].map(n => n + ':' + bucket((im.getAttribute(n) || '').length)).join(','));
              return JSON.stringify({
                texts: Array.from(texts.entries()).slice(0, 24).map(e => e[0] + '#' + e[1]), imgAttrs: imgAttrs,
                tree: tree,
                ctrls: Array.from(ctrls.entries()).slice(0, 14).map(e => e[0] + '#' + e[1]), iframes: frames.slice(0, 4), overlays: ovl,
                grid: Array.from(grid).slice(0, 6), pseudo: pseudo,
                text: bodyText.length === 0 ? '0' : bodyText.length < 100 ? 'lt100' : bodyText.length < 1000 ? 'lt1k' : 'ge1k',
                imgs: imgs.length, big: ir ? Math.round(ir.width) + 'x' + Math.round(ir.height) : 'none', stats: stats,
                names: Array.from(names).sort().join(','), attrs: Array.from(attrHits).sort().join(','),
                hits: Array.from(hits.entries()).slice(0, 8).map(e => e[0] + '#' + e[1]), stack: stack
              });
            }
            """;

    /** One marker line describing every frame of the page; never any page text. */
    static String probe(Page page, String stage) {
        List<Frame> frames;
        try {
            frames = new ArrayList<>(page.frames());
        } catch (RuntimeException e) {
            return "banner-layer[" + stage + "]=frames-unreadable";
        }
        StringBuilder sb = new StringBuilder("banner-layer[").append(stage).append("]=frames:").append(frames.size());
        int i = 0;
        for (Frame f : frames) {
            if (i >= 6) {
                break;
            }
            sb.append(" | f").append(i).append(f == page.mainFrame() ? "(main," : "(child,").append(PlaywrightSession.hostClass(f.url())).append("): ");
            try {
                Object r = f.evaluate(JS);
                String s = String.valueOf(r);
                sb.append(s.length() > 5200 ? s.substring(0, 5200) : s);
            } catch (PlaywrightException | IllegalStateException e) {
                sb.append("unreadable");
            }
            i++;
        }
        return sb.toString();
    }

    /**
     * A text response that carries banner label words: its shape is described by the caller; this returns the fixed-vocabulary label
     * names found, the distinct JSON key count, and the key names that match the banner key tokens. Empty when no label word is present.
     */
    static String describeBody(String body) {
        if (body == null || body.length() < 8) {
            return "";
        }
        String lower = body.toLowerCase(Locale.ROOT);
        TreeSet<String> names = new TreeSet<>();
        for (String w : new String[] {"camera code", "time since red", "speed limit", "yellow light", "incident number"}) {
            if (lower.contains(w) || lower.contains(w.replace(" ", ""))) {
                names.add(w.replace(' ', '-'));
            }
        }
        TreeSet<String> keys = new TreeSet<>();
        TreeSet<String> hitKeys = new TreeSet<>();
        Matcher m = JSON_KEY.matcher(body);
        while (m.find() && keys.size() < 999) {
            String k = m.group(1);
            keys.add(k);
            String norm = k.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
            for (String t : KEY_TOKENS) {
                if (norm.contains(t) && hitKeys.size() < 12) {
                    hitKeys.add(k);
                }
            }
        }
        if (names.isEmpty() && hitKeys.isEmpty()) {
            return "";
        }
        return "labels=" + String.join(",", names) + "/fields=" + keys.size() + "/keys=" + String.join(",", hitKeys);
    }
}
