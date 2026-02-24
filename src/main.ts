import { setTimeout } from 'node:timers/promises';

import { Actor, log } from 'apify';

import { INPUT_DEFAULTS } from './constants.js';
import { enrich, loadHistory, logEnrichStats, saveHistory } from './history.js';
import { scrapeAll } from './portals.js';
import type { Input } from './types.js';
import { calcPerPortal } from './utils.js';

await Actor.init();

Actor.on('aborting', async () => {
    // Temporary workaround until SDK implements proper state persistence in the aborting event:
    // https://github.com/apify/apify-sdk-js/pull/561
    await setTimeout(1000);
    await Actor.exit();
});

const {
    portals = INPUT_DEFAULTS.portals,
    categories = INPUT_DEFAULTS.categories,
    offerType = INPUT_DEFAULTS.offerType,
    regions = INPUT_DEFAULTS.regions,
    maxPrice = INPUT_DEFAULTS.maxPrice,
    minArea = INPUT_DEFAULTS.minArea,
    maxItems = INPUT_DEFAULTS.maxItems,
    maxConcurrency = INPUT_DEFAULTS.maxConcurrency,
    historyStoreId,
    bestDealThreshold = INPUT_DEFAULTS.bestDealThreshold,
} = (await Actor.getInput<Input>()) ?? ({} as Input);

log.info('Starting CZ Reality Scraper', {
    portals,
    categories,
    offerType,
    regions,
    maxPrice,
    minArea,
    maxItems,
    maxConcurrency,
});

if (portals.length === 0) {
    const message = 'Input validation error: "portals" must contain at least one portal.';
    log.error(message, { portals });

    throw new Error(message);
}
if (categories.length === 0) {
    const message = 'Input validation error: "categories" must contain at least one category.';
    log.error(message, { categories });

    throw new Error(message);
}

const input: Input = {
    portals,
    categories,
    offerType,
    regions,
    maxPrice,
    minArea,
    maxItems,
    maxConcurrency,
    historyStoreId,
    bestDealThreshold,
};
const perPortal = calcPerPortal(maxItems, portals.length);

const allListings = await scrapeAll(input, perPortal);

const historyStore = await Actor.openKeyValueStore(historyStoreId || undefined);
const history = await loadHistory(historyStore);
const { enriched, updatedHistory } = enrich(allListings, history, bestDealThreshold);
logEnrichStats(enriched);

await Actor.pushData(enriched);
await saveHistory(historyStore, updatedHistory);

log.info(`Done. Saved ${enriched.length} listings.`);
await Actor.exit();
