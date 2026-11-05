package cevoc.adapter.out.demo;

/**
 * Holder for the demo route and its sample certificate source. It exists as a bean only while demo data is on. It is deliberately
 * not itself a lookup port or certificate port, so it can never be mistaken for the configured route when one is chosen by type.
 */
public record DemoRoute(DemoPenaltyLookupAdapter adapter, DemoCertificateSource certificates) {}
