import { log } from 'apify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    buildRegionLookup,
    calcPricePerSqm,
    expandOfferTypes,
    normalizeRegions,
    warnInvalidRegions,
} from '../utils.js';

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

    it('should return 0 when price is 0 and floorArea is positive', () => {
        expect(calcPricePerSqm(0, 75)).toBe(0);
    });
});

describe('buildRegionLookup', () => {
    it('should map canonical name to value', () => {
        const result = buildRegionLookup({ Praha: 10 });

        expect(result.Praha).toBe(10);
    });

    it('should not include regions absent from the input', () => {
        const result = buildRegionLookup({ Praha: 10 });

        expect(result['Jihočeský']).toBeUndefined();
    });

    it('should map multiple regions', () => {
        const result = buildRegionLookup({ Praha: 10, Jihočeský: 31 });

        expect(result.Praha).toBe(10);
        expect(result['Jihočeský']).toBe(31);
        expect(Object.keys(result)).toHaveLength(2);
    });

    it('should work with string values', () => {
        const result = buildRegionLookup({ Praha: 'praha' });

        expect(result.Praha).toBe('praha');
    });
});

describe('normalizeRegions', () => {
    it("should filter out 'vse' sentinel", () => {
        expect(normalizeRegions(['vse'])).toEqual([]);
    });

    it("should filter out 'vse' when mixed with real regions", () => {
        expect(normalizeRegions(['vse', 'Praha'])).toEqual(['Praha']);
    });

    it('should return regions unchanged when no sentinel present', () => {
        expect(normalizeRegions(['Praha', 'Jihočeský'])).toEqual(['Praha', 'Jihočeský']);
    });

    it('should return empty array unchanged', () => {
        expect(normalizeRegions([])).toEqual([]);
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

    it("should not warn when regions contains only the 'vse' sentinel", () => {
        warnInvalidRegions(['vse'], {}, '[test]');

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
