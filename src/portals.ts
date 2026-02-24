import { log } from 'apify';

import { scrapeBezrealitky } from './scrapers/bezrealitky.js';
import { scrapeSreality } from './scrapers/sreality.js';
import type { Input, Listing, Portal } from './types.js';

type ScraperFn = (input: Input, maxItems: number) => Promise<Listing[]>;

const PORTAL_SCRAPERS: Record<Portal, ScraperFn> = {
    sreality: scrapeSreality,
    bezrealitky: scrapeBezrealitky,
};

export const scrapeAll = async (input: Input, perPortal: number): Promise<Listing[]> => {
    const results: Listing[] = [];

    for (const portal of input.portals) {
        if (input.maxItems != null && results.length >= input.maxItems) break;

        const cap = input.maxItems == null ? perPortal : Math.min(perPortal, input.maxItems - results.length);
        const listings = await PORTAL_SCRAPERS[portal](input, cap);

        results.push(...listings);
    }

    log.info(`Total listings scraped: ${results.length}`);

    return results;
};
