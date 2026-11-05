package cevoc.adapter.out.demo;

/**
 * Holder for the demo route. It exists as a bean only while demo data is on. It is deliberately not itself a lookup port, so
 * it can never be mistaken for the configured route when one is chosen by type.
 */
public record DemoRoute(DemoPenaltyLookupAdapter adapter) {}
