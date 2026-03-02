import { describe, expect, it } from 'vitest';

import { enrich } from '../history.js';
import type { Listing } from '../types.js';

const base: Listing = {
    id: 'sreality_domy_1',
    source: 'sreality',
    category: 'domy',
    name: 'Test House',
    price: 5_000_000,
    pricePerSqm: 25_000,
    locality: 'Praha',
    layout: '4+1',
    floorArea: 200,
    landArea: 500,
    lat: 50,
    lon: 14.5,
    imageUrl: null,
    url: 'https://www.sreality.cz/detail/prodej/dum/1',
};

describe('enrich', () => {
    it('should mark new listing as isNew=true with daysTracked=0', () => {
        const { enriched } = enrich([base], {});

        expect(enriched[0].isNew).toBe(true);
        expect(enriched[0].daysTracked).toBe(0);
        expect(enriched[0].priceChanged).toBe(false);
        expect(enriched[0].previousPrice).toBeNull();
    });

    it('should mark known listing with unchanged price as isNew=false and priceChanged=false', () => {
        const history = { sreality_domy_1: { price: 5_000_000, firstSeenAt: new Date().toISOString() } };
        const { enriched } = enrich([base], history);

        expect(enriched[0].isNew).toBe(false);
        expect(enriched[0].priceChanged).toBe(false);
        expect(enriched[0].previousPrice).toBeNull();
    });

    it('should detect price change and store previousPrice', () => {
        const history = { sreality_domy_1: { price: 6_000_000, firstSeenAt: new Date().toISOString() } };
        const { enriched } = enrich([base], history);

        expect(enriched[0].priceChanged).toBe(true);
        expect(enriched[0].previousPrice).toBe(6_000_000);
    });

    it('should compute priceToMedianRatio relative to run median', () => {
        const listings: Listing[] = [
            { ...base, id: 'a', pricePerSqm: 20_000 }, // 20% below median → ratio 0.8
            { ...base, id: 'b', pricePerSqm: 25_000 }, // at median → ratio 1.0
            { ...base, id: 'c', pricePerSqm: 30_000 }, // above median → ratio 1.2
        ];
        const { enriched } = enrich(listings, {});

        expect(enriched[0].priceToMedianRatio).toBe(0.8);
        expect(enriched[1].priceToMedianRatio).toBe(1);
        expect(enriched[2].priceToMedianRatio).toBe(1.2);
    });

    it('should set priceToMedianRatio to null when pricePerSqm is null', () => {
        const { enriched } = enrich([{ ...base, pricePerSqm: null }], {});

        expect(enriched[0].priceToMedianRatio).toBeNull();
    });

    it('should preserve firstSeenAt and calculate daysTracked for a known listing', () => {
        const firstSeenAt = new Date(Date.now() - 3 * 86_400_000).toISOString(); // 3 days ago
        const history = { sreality_domy_1: { price: 5_000_000, firstSeenAt } };
        const { enriched, updatedHistory } = enrich([base], history);

        expect(enriched[0].daysTracked).toBe(3);
        expect(updatedHistory.sreality_domy_1.firstSeenAt).toBe(firstSeenAt);
    });

    it('should set firstSeenAt in updatedHistory for a new listing', () => {
        const before = Date.now();
        const { updatedHistory } = enrich([base], {});
        const after = Date.now();
        const firstSeenAt = new Date(updatedHistory.sreality_domy_1.firstSeenAt).getTime();

        expect(firstSeenAt).toBeGreaterThanOrEqual(before);
        expect(firstSeenAt).toBeLessThanOrEqual(after);
    });

    it('should return empty enriched array for empty input', () => {
        const { enriched, updatedHistory } = enrich([], {});

        expect(enriched).toHaveLength(0);
        expect(updatedHistory).toEqual({});
    });
});
