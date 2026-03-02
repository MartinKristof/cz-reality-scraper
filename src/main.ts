import { setTimeout } from 'node:timers/promises';

import { Actor, log } from 'apify';

import { enrich, loadHistory, logEnrichStats, saveHistory } from './history.js';
import { scrapeAll } from './portals.js';
import type { EnrichedListing, HistoryStore, Input } from './types.js';

await Actor.init();

Actor.on('aborting', async () => {
    // Temporary workaround until SDK implements proper state persistence in the aborting event:
    // https://github.com/apify/apify-sdk-js/pull/561
    await setTimeout(1000);
    await Actor.exit();
});

const input = await Actor.getInputOrThrow<Input>();

log.info('Starting CZ Reality Scraper', {
    portals: input.portals,
    categories: input.categories,
    offerType: input.offerType,
    regions: input.regions,
    maxPrice: input.maxPrice,
    minArea: input.minArea,
    maxListings: input.maxListings,
    enableHistory: input.enableHistory,
});

const historyStore = input.enableHistory ? await Actor.openKeyValueStore(input.historyStoreId || 'HISTORY') : null;
let history: HistoryStore = historyStore ? await loadHistory(historyStore) : {};
const allEnriched: EnrichedListing[] = [];
let totalSaved = 0;

await scrapeAll(input, async (listings) => {
    if (historyStore) {
        const { enriched, updatedHistory } = enrich(listings, history);
        history = updatedHistory;
        allEnriched.push(...enriched);
        await Actor.charge({ eventName: 'listing-enriched', count: enriched.length });
        await Actor.pushData(enriched);
        totalSaved += enriched.length;
    } else {
        await Actor.pushData(listings);
        totalSaved += listings.length;
    }
});

if (historyStore) {
    logEnrichStats(allEnriched);
    await saveHistory(historyStore, history);
}

log.info(`Done. Saved ${totalSaved} listings.`);
await Actor.exit();
