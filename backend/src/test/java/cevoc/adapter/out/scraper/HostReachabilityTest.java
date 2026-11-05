package cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.InetAddress;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Literal addresses only (documentation and private ranges); no DNS lookups. */
class HostReachabilityTest {

    private static InetAddress ip(String s) throws Exception {
        return InetAddress.getByName(s);
    }

    @Test
    void classifiesAddressKinds() throws Exception {
        assertEquals("public", HostReachability.kind(ip("93.184.216.34")));
        assertEquals("private", HostReachability.kind(ip("10.1.2.3")));
        assertEquals("private", HostReachability.kind(ip("172.16.0.1")));
        assertEquals("public", HostReachability.kind(ip("172.32.0.1")));
        assertEquals("private", HostReachability.kind(ip("192.168.1.1")));
        assertEquals("cgnat", HostReachability.kind(ip("100.64.0.1")));
        assertEquals("cgnat", HostReachability.kind(ip("100.127.255.255")));
        assertEquals("public", HostReachability.kind(ip("100.128.0.1")));
        assertEquals("link-local", HostReachability.kind(ip("169.254.1.1")));
        assertEquals("loopback", HostReachability.kind(ip("127.0.0.1")));
        assertEquals("private", HostReachability.kind(ip("fd00::1")));
        assertEquals("link-local", HostReachability.kind(ip("fe80::1")));
        assertEquals("public", HostReachability.kind(ip("2606:4700:4700::1111")));
    }

    @Test
    void summaryNeverContainsAddresses() throws Exception {
        String s = HostReachability.summarise(List.of(ip("10.1.2.3"), ip("93.184.216.34"), ip("2606:4700:4700::1111")));
        assertEquals("kinds=private:1,public:2 v4=2 v6=1", s);
        assertFalse(s.contains("10.1"));
        assertEquals("kinds=none ip=none", HostReachability.summarise(List.of()));
    }

    @Test
    void hostIsTakenFromTheUrl() {
        assertEquals("apps.example.test", HostReachability.hostOf("https://apps.example.test/x/y.jsf"));
        assertEquals("unknown", HostReachability.hostOf("not a url"));
    }

    @Test
    void unresolvableNameIsReportedWithoutThrowing() {
        String l = HostReachability.line("no-such-host.invalid");
        assertTrue(l.contains("jvm=failed"), l);
    }
}
