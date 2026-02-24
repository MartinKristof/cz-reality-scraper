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
        const { enriched } = enrich([base], {}, 0.85);

        expect(enriched[0].isNew).toBe(true);
        expect(enriched[0].daysTracked).toBe(0);
        expect(enriched[0].priceChanged).toBe(false);
        expect(enriched[0].previousPrice).toBeNull();
    });

    it('should mark known listing as isNew=false', () => {
        const history = { sreality_domy_1: { price: 5_000_000, firstSeenAt: new Date().toISOString() } };
        const { enriched } = enrich([base], history, 0.85);

        expect(enriched[0].isNew).toBe(false);
    });

    it('should detect price change and store previousPrice', () => {
        const history = { sreality_domy_1: { price: 6_000_000, firstSeenAt: new Date().toISOString() } };
        const { enriched } = enrich([base], history, 0.85);

        expect(enriched[0].priceChanged).toBe(true);
        expect(enriched[0].previousPrice).toBe(6_000_000);
    });

    it('should not flag priceChanged when price is unchanged', () => {
        const history = { sreality_domy_1: { price: 5_000_000, firstSeenAt: new Date().toISOString() } };
        const { enriched } = enrich([base], history, 0.85);

        expect(enriched[0].priceChanged).toBe(false);
    });

    it('should flag isBestDeal for listing 15% below median pricePerSqm', () => {
        const listings: Listing[] = [
            { ...base, id: 'a', pricePerSqm: 20_000 }, // 20% below median → best deal
            { ...base, id: 'b', pricePerSqm: 25_000 }, // at median
            { ...base, id: 'c', pricePerSqm: 30_000 }, // above median
        ];
        const { enriched } = enrich(listings, {}, 0.85);

        expect(enriched[0].isBestDeal).toBe(true);
        expect(enriched[1].isBestDeal).toBe(false);
        expect(enriched[2].isBestDeal).toBe(false);
    });

    it('should not flag isBestDeal when pricePerSqm is null', () => {
        const { enriched } = enrich([{ ...base, pricePerSqm: null }], {}, 0.85);

        expect(enriched[0].isBestDeal).toBe(false);
    });

    it('should preserve firstSeenAt from existing history', () => {
        const firstSeenAt = '2024-01-01T00:00:00.000Z';
        const history = { sreality_domy_1: { price: 5_000_000, firstSeenAt } };
        const { updatedHistory } = enrich([base], history, 0.85);

        expect(updatedHistory.sreality_domy_1.firstSeenAt).toBe(firstSeenAt);
    });

    it('should calculate daysTracked > 0 for listing seen in the past', () => {
        const firstSeenAt = new Date(Date.now() - 3 * 86_400_000).toISOString(); // 3 days ago
        const history = { sreality_domy_1: { price: 5_000_000, firstSeenAt } };
        const { enriched } = enrich([base], history, 0.85);

        expect(enriched[0].daysTracked).toBe(3);
    });

    it('should set firstSeenAt in updatedHistory for a new listing', () => {
        const before = Date.now();
        const { updatedHistory } = enrich([base], {}, 0.85);
        const after = Date.now();
        const firstSeenAt = new Date(updatedHistory.sreality_domy_1.firstSeenAt).getTime();

        expect(firstSeenAt).toBeGreaterThanOrEqual(before);
        expect(firstSeenAt).toBeLessThanOrEqual(after);
    });

    it('should return empty enriched array for empty input', () => {
        const { enriched, updatedHistory } = enrich([], {}, 0.85);

        expect(enriched).toHaveLength(0);
        expect(updatedHistory).toEqual({});
    });
});
