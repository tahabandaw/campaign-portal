import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  normalizeBoolean,
  normalizeEmail,
  normalizeNullish,
  normalizeDecimal,
  mapColumnName,
  isValidStatus,
  normalizeStatus,
  trimAll,
} from '../scripts/normalize';

describe('Data Ingestion Normalization Rules', () => {
  describe('detectDelimiter', () => {
    it('detects comma for standard CSV', () => {
      expect(detectDelimiter('external_id,full_name,email,phone')).toBe(',');
    });

    it('detects semicolon for Marrakech French CSV', () => {
      expect(detectDelimiter('external_id;full_name;e_mail;mobile;pays')).toBe(';');
    });
  });

  describe('normalizeDecimal', () => {
    it('handles European comma decimals in Marrakech spend', () => {
      expect(normalizeDecimal('221,09')).toBe(221.09);
      expect(normalizeDecimal('61,81')).toBe(61.81);
      expect(normalizeDecimal('1.420,00')).toBe(1420.00);
    });

    it('handles standard period decimals in Kilele / Karoo spend', () => {
      expect(normalizeDecimal('650.07')).toBe(650.07);
      expect(normalizeDecimal('1029.12')).toBe(1029.12);
    });
  });

  describe('normalizeBoolean (consent_marketing variants)', () => {
    it('normalizes truthy representations to true', () => {
      expect(normalizeBoolean('true')).toBe(true);
      expect(normalizeBoolean('TRUE')).toBe(true);
      expect(normalizeBoolean('1')).toBe(true);
      expect(normalizeBoolean('Y')).toBe(true);
      expect(normalizeBoolean('yes')).toBe(true);
      expect(normalizeBoolean('active')).toBe(true);
      expect(normalizeBoolean('Active')).toBe(true);
      expect(normalizeBoolean('t')).toBe(true);
    });

    it('normalizes falsy representations to false', () => {
      expect(normalizeBoolean('false')).toBe(false);
      expect(normalizeBoolean('FALSE')).toBe(false);
      expect(normalizeBoolean('0')).toBe(false);
      expect(normalizeBoolean('no')).toBe(false);
      expect(normalizeBoolean('f')).toBe(false);
      expect(normalizeBoolean('n')).toBe(false);
    });

    it('returns null for empty or undefined', () => {
      expect(normalizeBoolean('')).toBeNull();
      expect(normalizeBoolean(undefined)).toBeNull();
      expect(normalizeBoolean('  ')).toBeNull();
    });
  });

  describe('normalizeNullish (country dirty strings)', () => {
    it('cleans database artifacts and literal nulls', () => {
      expect(normalizeNullish('none')).toBeNull();
      expect(normalizeNullish('NULL')).toBeNull();
      expect(normalizeNullish('null')).toBeNull();
      expect(normalizeNullish('\\N')).toBeNull();
      expect(normalizeNullish('')).toBeNull();
    });

    it('preserves valid country codes', () => {
      expect(normalizeNullish('KE')).toBe('KE');
      expect(normalizeNullish('ZA')).toBe('ZA');
      expect(normalizeNullish('MA')).toBe('MA');
    });
  });

  describe('mapColumnName (header normalization)', () => {
    it('maps Karoo Title Case headers', () => {
      expect(mapColumnName('Full Name')).toBe('full_name');
      expect(mapColumnName('External Id')).toBe('external_id');
      expect(mapColumnName('Signup At')).toBe('signup_at');
      expect(mapColumnName('Consent Marketing')).toBe('consent_marketing');
    });

    it('maps Marrakech French headers', () => {
      expect(mapColumnName('pays')).toBe('country');
      expect(mapColumnName('e_mail')).toBe('email');
      expect(mapColumnName('mobile')).toBe('phone');
    });
  });

  describe('isValidStatus & normalizeStatus', () => {
    it('detects dates that leaked into status column', () => {
      expect(isValidStatus('2026-04-11T01:19:02Z')).toBe(false);
      expect(normalizeStatus('2026-04-11T01:19:02Z')).toBe('unknown');
    });

    it('validates standard statuses', () => {
      expect(isValidStatus('active')).toBe(true);
      expect(isValidStatus('bounced')).toBe(true);
      expect(isValidStatus('unsubscribed')).toBe(true);
      expect(normalizeStatus('active ')).toBe('active');
      expect(normalizeStatus('unsubscribe')).toBe('unsubscribed');
    });
  });

  describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
      expect(normalizeEmail(' USER@VG-EVAL.TEST ')).toBe('user@vg-eval.test');
      expect(normalizeEmail('')).toBeNull();
    });
  });
});
