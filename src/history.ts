import { Actor, log } from 'apify';

import { BEST_DEAL_THRESHOLD, LISTING_HISTORY_KEY } from './constants.js';
import type { EnrichedListing, HistoryEntry, HistoryStore, Listing } from './types.js';

export async function loadHistory(): Promise<HistoryStore> {
    return (await Actor.getValue<HistoryStore>(LISTING_HISTORY_KEY)) ?? {};
}

export async function saveHistory(history: HistoryStore): Promise<void> {
    await Actor.setValue(LISTING_HISTORY_KEY, history);
}

export function enrich(
    listings: Listing[],
    history: HistoryStore,
): { enriched: EnrichedListing[]; updatedHistory: HistoryStore } {
    const now = new Date().toISOString();
    const updatedHistory: HistoryStore = { ...history };

    // Global median pricePerSqm for isBestDeal (15% below median = good deal)
    const validPrices = listings
        .map((l) => l.pricePerSqm)
        .filter((p): p is number => p !== null)
        .sort((a, b) => a - b);
    const median = validPrices.length > 0 ? validPrices[Math.floor(validPrices.length / 2)] : null;

    const enriched = listings.map((listing): EnrichedListing => {
        const prev: HistoryEntry | undefined = history[listing.id];

        updatedHistory[listing.id] = {
            price: listing.price,
            firstSeenAt: prev?.firstSeenAt ?? now,
        };

        const firstSeen = new Date(prev?.firstSeenAt ?? now);
        const daysOnMarket = Math.floor((Date.now() - firstSeen.getTime()) / 86_400_000);
        const priceChanged = prev != null && prev.price !== listing.price;

        return {
            ...listing,
            isNew: !prev,
            priceChanged,
            previousPrice: priceChanged ? (prev?.price ?? null) : null,
            daysOnMarket,
            isBestDeal:
                median !== null && listing.pricePerSqm !== null && listing.pricePerSqm < median * BEST_DEAL_THRESHOLD,
        };
    });

    return { enriched, updatedHistory };
}

export function logEnrichStats(enriched: EnrichedListing[]): void {
    const newCount = enriched.filter((l) => l.isNew).length;
    const priceDropCount = enriched.filter(
        (l) => l.priceChanged && l.previousPrice != null && l.price != null && l.price < l.previousPrice,
    ).length;
    const bestDealCount = enriched.filter((l) => l.isBestDeal).length;
    log.info('History stats', { newListings: newCount, priceDrops: priceDropCount, bestDeals: bestDealCount });
}
