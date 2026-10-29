package au.gov.nsw.transport.cevoc.adapter.out.scraper;

/** The source could not be read or its structure was not what the parser expects. Messages must not contain notice numbers. */
public class ScrapeException extends RuntimeException {
    public ScrapeException(String message) { super(message); }
    public ScrapeException(String message, Throwable cause) { super(message, cause); }
}
