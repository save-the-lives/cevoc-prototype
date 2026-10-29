package au.gov.nsw.transport.cevoc.domain;

/** How the notice was issued. Decides whether evidence and certificates apply. Held as data per notice, never inferred from the offence name. */
public enum EnforcementMethod { CAMERA, OFFICER_ISSUED, UNKNOWN }
