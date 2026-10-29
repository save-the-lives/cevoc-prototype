package au.gov.nsw.transport.cevoc.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/** The notice facts we show, mirroring what the Revenue NSW penalty page presents. */
public record NoticeDetails(
        String offenceDescription,
        LocalDate offenceDate,
        LocalTime offenceTime,
        String location,
        BigDecimal penaltyAmount,
        BigDecimal amountOwing,
        NoticeStatus noticeStatus,
        String statusMessage,
        EnforcementMethod enforcementMethod) {}
