package au.gov.nsw.transport.cevoc.domain;

import java.time.Instant;

/** A short-lived, unguessable link to a media object. The backend hands these out; it never proxies the bytes. */
public record SignedLink(String url, Instant expiresAt) {}
