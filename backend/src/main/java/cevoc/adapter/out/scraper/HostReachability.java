package cevoc.adapter.out.scraper;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Hashtable;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;

/**
 * DNS reachability diagnostic for the owner's live check. For a host name it reports, as numbers and fixed words only,
 * whether the name resolves from inside this app (JVM resolver and a direct resolver query), the KIND of each address
 * (public, private, cgnat, link-local, loopback, other), the IP version, the resolver addresses in use and timings.
 * It never prints a resolved address, never contacts the host over HTTP and never reads or prints page content.
 */
public final class HostReachability {

    /** Public control hosts: a known public host, the Revenue NSW API host, and the older certificate host. */
    public static final List<String> CONTROL_HOSTS = List.of("github.com", "api.osr.nsw.gov.au", "cevoc.transport.nsw.gov.au");

    private static final long LIMIT_MS = 6000;

    private HostReachability() {}

    /** Address kinds, one token each. */
    public static String kind(InetAddress a) {
        byte[] b = a.getAddress();
        if (a.isLoopbackAddress()) return "loopback";
        if (a.isLinkLocalAddress()) return "link-local";
        if (a instanceof Inet4Address) {
            int o1 = b[0] & 0xff, o2 = b[1] & 0xff;
            if (o1 == 10 || (o1 == 172 && o2 >= 16 && o2 <= 31) || (o1 == 192 && o2 == 168)) return "private";
            if (o1 == 100 && o2 >= 64 && o2 <= 127) return "cgnat";
            if (o1 == 0 || o1 >= 240 || (o1 == 198 && (o2 == 18 || o2 == 19)) || (o1 == 192 && o2 == 0 && (b[2] & 0xff) == 0)) return "other";
        } else if (a instanceof Inet6Address) {
            if ((b[0] & 0xfe) == 0xfc) return "private";
        }
        if (a.isAnyLocalAddress() || a.isMulticastAddress()) return "other";
        return "public";
    }

    /** "public=2 private=0 ..." plus "v4=2 v6=0" for the given addresses (zero kinds left out). */
    public static String summarise(List<InetAddress> addrs) {
        if (addrs.isEmpty()) return "kinds=none ip=none";
        java.util.Map<String, Integer> k = new java.util.TreeMap<>();
        int v4 = 0, v6 = 0;
        for (InetAddress a : addrs) {
            k.merge(kind(a), 1, Integer::sum);
            if (a instanceof Inet4Address) v4++; else v6++;
        }
        StringBuilder sb = new StringBuilder("kinds=");
        k.forEach((n, c) -> sb.append(n).append(':').append(c).append(','));
        sb.setLength(sb.length() - 1);
        return sb.append(" v4=").append(v4).append(" v6=").append(v6).toString();
    }

    public static String hostOf(String pageUrl) {
        try {
            String h = URI.create(pageUrl).getHost();
            return h == null ? "unknown" : h;
        } catch (RuntimeException e) {
            return "unknown";
        }
    }

    /** Resolver addresses configured for this process (nameserver lines of resolv.conf), as address plus kind. */
    public static String resolvers() {
        try {
            List<String> out = new ArrayList<>();
            for (String line : Files.readAllLines(Path.of("/etc/resolv.conf"))) {
                String t = line.trim();
                if (t.startsWith("nameserver")) {
                    String ip = t.substring("nameserver".length()).trim();
                    if (ip.matches("[0-9a-fA-F:.]{3,45}")) {
                        out.add(ip + "(" + kind(InetAddress.getByName(ip)) + ")");
                    }
                }
            }
            return out.isEmpty() ? "none-listed" : String.join(",", out);
        } catch (Exception e) {
            return "unreadable";
        }
    }

    /** One line for one host: JVM lookup and a direct resolver query (A, AAAA, CNAME counts). */
    public static String line(String host) {
        StringBuilder sb = new StringBuilder("  ").append(host).append(" : ");
        long t0 = System.nanoTime();
        try {
            List<InetAddress> addrs = within(() -> List.of(InetAddress.getAllByName(host)));
            sb.append("jvm=resolved ").append(summarise(addrs));
        } catch (Exception e) {
            sb.append("jvm=failed(").append(reason(e)).append(')');
        }
        sb.append(" ").append(ms(t0)).append("ms");
        long t1 = System.nanoTime();
        try {
            int[] c = within(() -> query(host));
            sb.append(" | resolver A=").append(c[0]).append(" AAAA=").append(c[1]).append(" CNAME=").append(c[2]);
        } catch (Exception e) {
            sb.append(" | resolver query=").append(reason(e));
        }
        return sb.append(' ').append(ms(t1)).append("ms").toString();
    }

    /** The block for the live summary: resolvers, the certificates page host, then the control hosts. */
    public static String report(String pageUrl) {
        StringBuilder sb = new StringBuilder("dns diagnostic     : resolvers=").append(resolvers()).append('\n');
        sb.append("certificates host :\n").append(line(hostOf(pageUrl))).append('\n');
        sb.append("control hosts     :\n");
        for (String h : CONTROL_HOSTS) {
            sb.append(line(h)).append('\n');
        }
        return sb.toString();
    }

    private static int[] query(String host) throws Exception {
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("java.naming.provider.url", "dns:");
        env.put("com.sun.jndi.dns.timeout.initial", "2000");
        env.put("com.sun.jndi.dns.timeout.retries", "2");
        var ctx = new InitialDirContext(env);
        try {
            Attributes at = ctx.getAttributes(host, new String[] {"A", "AAAA", "CNAME"});
            return new int[] {count(at.get("A")), count(at.get("AAAA")), count(at.get("CNAME"))};
        } finally {
            ctx.close();
        }
    }

    private static int count(Attribute a) {
        return a == null ? 0 : a.size();
    }

    private static <T> T within(Callable<T> task) throws Exception {
        ExecutorService ex = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "host-reachability");
            t.setDaemon(true);
            return t;
        });
        try {
            Future<T> f = ex.submit(task);
            try {
                return f.get(LIMIT_MS, TimeUnit.MILLISECONDS);
            } catch (java.util.concurrent.ExecutionException e) {
                throw e.getCause() instanceof Exception c ? c : e;
            } catch (java.util.concurrent.TimeoutException e) {
                f.cancel(true);
                throw e;
            }
        } finally {
            ex.shutdownNow();
        }
    }

    /** Fixed vocabulary: the exception class name (letters only) and, for DNS name errors, the word nxdomain. */
    static String reason(Throwable e) {
        String n = e.getClass().getSimpleName().replaceAll("[^A-Za-z]", "");
        if (e instanceof javax.naming.NameNotFoundException) return "nxdomain";
        return n.length() > 40 ? n.substring(0, 40) : n;
    }

    private static long ms(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
