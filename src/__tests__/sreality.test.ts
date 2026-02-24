import { describe, expect, it } from 'vitest';

import { parseArea } from '../scrapers/sreality.js';

describe('parseArea', () => {
    it('should return a number given a number', () => {
        expect(parseArea(288)).toBe(288);
    });

    it('should strip units from string like "288 m²"', () => {
        expect(parseArea('288 m²')).toBe(288);
    });

    it('should replace Czech decimal comma', () => {
        expect(parseArea('1,5')).toBe(1.5);
    });

    it('should handle integer string', () => {
        expect(parseArea('100')).toBe(100);
    });

    it('should return null for undefined', () => {
        expect(parseArea(undefined)).toBeNull();
    });

    it('should return null for non-numeric string', () => {
        expect(parseArea('bez ceny')).toBeNull();
    });
});
