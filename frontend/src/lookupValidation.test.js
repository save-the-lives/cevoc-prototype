import { describe, expect, it } from 'vitest';
import { checkDate, checkNotice, checkRegistration, cleanRegistration, earliestIso, partsToIso, todayIso } from './lookupValidation.js';

const NOW = new Date(2026, 10, 4); // 4 Nov 2026
const p = (d, m, y) => ({ d, m, y });

describe('notice number', () => {
  it('asks for ten digits in plain words', () => {
    expect(checkNotice('')).toMatch(/Enter the penalty notice number/);
    expect(checkNotice('90000x0001')).toMatch(/only contain numbers/);
    expect(checkNotice('900000001')).toMatch(/must be 10 digits. You entered 9/);
    expect(checkNotice('9000 000-001')).toBeNull();
  });
});

describe('registration number', () => {
  it('is optional and tolerant of spaces and dashes', () => {
    expect(checkRegistration('')).toBeNull();
    expect(checkRegistration('  ')).toBeNull();
    expect(checkRegistration('tst-123')).toBeNull();
    expect(cleanRegistration(' tst 123 ')).toBe('TST123');
  });
  it('rejects symbols and over-long values', () => {
    expect(checkRegistration('TST!23')).toMatch(/letters and numbers/);
    expect(checkRegistration('TST123456')).toMatch(/up to 8/);
  });
});

describe('offence date', () => {
  it('names the missing part', () => {
    expect(checkDate(p('', '', ''), NOW).msg).toBe('Enter the date of the offence');
    expect(checkDate(p('4', '', '2026'), NOW)).toEqual({ msg: 'The date must include a month', bad: ['m'] });
  });
  it('rejects impossible, future and old dates', () => {
    expect(checkDate(p('31', '2', '2026'), NOW).msg).toMatch(/February 2026 doesn’t have a day 31/);
    expect(checkDate(p('5', '11', '2026'), NOW).msg).toMatch(/must be in the past/);
    expect(checkDate(p('1', '1', '2020'), NOW).msg).toMatch(/within the last 3 years/);
    expect(checkDate(p('1', '1', '26'), NOW).msg).toMatch(/4 digits/);
  });
  it('accepts a real recent date and converts it to ISO', () => {
    expect(checkDate(p('14', '3', '2026'), NOW)).toBeNull();
    expect(partsToIso(p('4', '3', '2026'))).toBe('2026-03-04');
    expect(todayIso(NOW)).toBe('2026-11-04');
    expect(earliestIso(NOW)).toBe('2023-11-04');
  });
});
