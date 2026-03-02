import type { KeyValueStore } from 'apify';
import { log } from 'apify';

import { LISTING_HISTORY_KEY } from './constants.js';
import type { EnrichedListing, HistoryEntry, HistoryStore, Listing } from './types.js';

export const loadHistory = async (store: KeyValueStore): Promise<HistoryStore> =>
    (await store.getValue<HistoryStore>(LISTING_HISTORY_KEY)) ?? {};

export const saveHistory = async (store: KeyValueStore, history: HistoryStore): Promise<void> => {
    await store.setValue(LISTING_HISTORY_KEY, history);
};

export const enrich = (
    listings: Listing[],
    history: HistoryStore,
): { enriched: EnrichedListing[]; updatedHistory: HistoryStore } => {
    const now = new Date().toISOString();
    const updatedHistory: HistoryStore = { ...history };

    const validPrices = listings
        .map(({ pricePerSqm }) => pricePerSqm)
        .filter((price): price is number => price !== null)
        .sort((priceA, priceB) => priceA - priceB);
    const median = validPrices.length > 0 ? validPrices[Math.floor(validPrices.length / 2)] : null;

    const enriched = listings.map((listing): EnrichedListing => {
        const { id, price, pricePerSqm } = listing;
        const prev: HistoryEntry | undefined = history[id];

        updatedHistory[id] = {
            price,
            firstSeenAt: prev?.firstSeenAt ?? now,
        };

        const firstSeen = new Date(prev?.firstSeenAt ?? now);
        const daysTracked = Math.floor((Date.now() - firstSeen.getTime()) / 86_400_000);
        const priceChanged = prev != null && prev.price !== price;
        const priceToMedianRatio =
            median !== null && pricePerSqm !== null ? Math.round((pricePerSqm / median) * 100) / 100 : null;

        return {
            ...listing,
            isNew: !prev,
            priceChanged,
            previousPrice: priceChanged ? (prev?.price ?? null) : null,
            daysTracked,
            priceToMedianRatio,
        };
    });

    return { enriched, updatedHistory };
};

export const logEnrichStats = (enriched: EnrichedListing[]): void => {
    const newCount = enriched.filter(({ isNew }) => isNew).length;
    const priceDropCount = enriched.filter(
        ({ priceChanged, previousPrice, price }) =>
            priceChanged && previousPrice != null && price != null && price < previousPrice,
    ).length;

    log.info('History stats', { newListings: newCount, priceDrops: priceDropCount });
};
