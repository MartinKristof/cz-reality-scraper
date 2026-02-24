import { setTimeout } from 'node:timers/promises';

import { Actor, log } from 'apify';

import { INPUT_DEFAULTS } from './constants.js';
import { enrich, loadHistory, logEnrichStats, saveHistory } from './history.js';
import { scrapeAll } from './portals.js';
import type { Input } from './types.js';
import { calcPerPortal } from './utils.js';

await Actor.init();

Actor.on('aborting', async () => {
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
} = (await Actor.getInput<Input>()) ?? ({} as Input);

log.info('Starting CZ Reality Scraper', { portals, categories, offerType, regions, maxPrice, minArea, maxItems });

const input: Input = { portals, categories, offerType, regions, maxPrice, minArea, maxItems };
const perPortal = calcPerPortal(maxItems, portals.length);

const allListings = await scrapeAll(input, perPortal);

const history = await loadHistory();
const { enriched, updatedHistory } = enrich(allListings, history);
logEnrichStats(enriched);

await Actor.pushData(enriched);
await saveHistory(updatedHistory);

log.info(`Done. Saved ${enriched.length} listings.`);
await Actor.exit();
