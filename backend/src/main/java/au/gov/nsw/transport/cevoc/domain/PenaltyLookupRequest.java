package au.gov.nsw.transport.cevoc.domain;

import java.time.LocalDate;

/** What the motorist gives us: the notice number and the offence date. */
public record PenaltyLookupRequest(String infringementNumber, LocalDate offenceDate) {}
