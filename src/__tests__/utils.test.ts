import { log } from 'apify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildRegionLookup, calcPerPortal, calcPricePerSqm, expandOfferTypes, warnInvalidRegions } from '../utils.js';

describe('expandOfferTypes', () => {
    it("should expand 'vse' to both offer types", () => {
        expect(expandOfferTypes('vse')).toEqual(['prodej', 'pronajem']);
    });

    it("should wrap 'prodej' in an array", () => {
        expect(expandOfferTypes('prodej')).toEqual(['prodej']);
    });

    it("should wrap 'pronajem' in an array", () => {
        expect(expandOfferTypes('pronajem')).toEqual(['pronajem']);
    });
});

describe('calcPricePerSqm', () => {
    it('should calculate and round price per sqm', () => {
        expect(calcPricePerSqm(1_000_000, 75)).toBe(13_333);
    });

    it('should return null when price is null', () => {
        expect(calcPricePerSqm(null, 75)).toBeNull();
    });

    it('should return null when floorArea is null', () => {
        expect(calcPricePerSqm(1_000_000, null)).toBeNull();
    });

    it('should return null when price is undefined', () => {
        expect(calcPricePerSqm(undefined, 75)).toBeNull();
    });

    it('should return null when floorArea is 0', () => {
        expect(calcPricePerSqm(1_000_000, 0)).toBeNull();
    });
});

describe('buildRegionLookup', () => {
    it('should map canonical name to value', () => {
        const result = buildRegionLookup({ Praha: 10 });

        expect(result.Praha).toBe(10);
    });

    it('should also map alias to the same value', () => {
        const result = buildRegionLookup({ Středočeský: 20 });

        expect(result['Středočeský']).toBe(20);
        expect(result['Středočeský kraj']).toBe(20);
    });

    it('should not include regions absent from the input', () => {
        const result = buildRegionLookup({ Praha: 10 });

        expect(result['Jihočeský']).toBeUndefined();
        expect(result['Jihočeský kraj']).toBeUndefined();
    });

    it('should expand all aliases for multiple regions', () => {
        const result = buildRegionLookup({ Praha: 10, Jihočeský: 31 });

        expect(result.Praha).toBe(10);
        expect(result['Jihočeský']).toBe(31);
        expect(result['Jihočeský kraj']).toBe(31);
        expect(Object.keys(result)).toHaveLength(3);
    });

    it('should work with string values', () => {
        const result = buildRegionLookup({ Praha: 'praha' });

        expect(result.Praha).toBe('praha');
    });
});

describe('warnInvalidRegions', () => {
    beforeEach(() => {
        vi.spyOn(log, 'warning').mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not warn when regions array is empty', () => {
        warnInvalidRegions([], { Praha: 10 }, '[test]');

        expect(log.warning).not.toHaveBeenCalled();
    });

    it('should not warn when all regions are valid', () => {
        warnInvalidRegions(['Praha', 'Jihočeský'], { Praha: 10, Jihočeský: 31 }, '[test]');

        expect(log.warning).not.toHaveBeenCalled();
    });

    it('should warn listing the invalid region name', () => {
        warnInvalidRegions(['Praha', 'Unknown'], { Praha: 10 }, '[test]');

        expect(log.warning).toHaveBeenCalledWith('[test] Ignoring unrecognised region names: Unknown');
    });

    it('should list all invalid region names in one warning', () => {
        warnInvalidRegions(['Bad1', 'Bad2'], {}, '[test]');

        expect(log.warning).toHaveBeenCalledWith('[test] Ignoring unrecognised region names: Bad1, Bad2');
    });
});

describe('calcPerPortal', () => {
    it('should distribute evenly across portals', () => {
        expect(calcPerPortal(100, 2)).toBe(50);
    });

    it('should round up when not evenly divisible', () => {
        expect(calcPerPortal(100, 3)).toBe(34);
    });

    it('should return Infinity when maxItems is null (no limit)', () => {
        expect(calcPerPortal(null, 2)).toBe(Infinity);
    });

    it('should return Infinity for a single portal with no limit', () => {
        expect(calcPerPortal(null, 1)).toBe(Infinity);
    });

    it('should handle a single portal', () => {
        expect(calcPerPortal(50, 1)).toBe(50);
    });

    it('should return 0 when portalCount is 0', () => {
        expect(calcPerPortal(100, 0)).toBe(0);
    });

    it('should return 0 when portalCount is negative', () => {
        expect(calcPerPortal(100, -1)).toBe(0);
    });
});
