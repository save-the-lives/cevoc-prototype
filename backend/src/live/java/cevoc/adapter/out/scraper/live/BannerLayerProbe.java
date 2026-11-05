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
              return JSON.stringify({
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
                sb.append(s.length() > 1600 ? s.substring(0, 1600) : s);
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
