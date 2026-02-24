import { log } from 'apify';

import { scrapeBezrealitky } from './scrapers/bezrealitky.js';
import { scrapeSreality } from './scrapers/sreality.js';
import type { Input, Listing, Portal } from './types.js';

type ScraperFn = (input: Input, maxItems: number) => Promise<Listing[]>;

const PORTAL_SCRAPERS: Record<Portal, ScraperFn> = {
    sreality: scrapeSreality,
    bezrealitky: scrapeBezrealitky,
};

export async function scrapeAll(input: Input, perPortal: number): Promise<Listing[]> {
    const results: Listing[] = [];
    for (const portal of input.portals) {
        const listings = await PORTAL_SCRAPERS[portal](input, perPortal);
        results.push(...listings);
    }
    log.info(`Total listings scraped: ${results.length}`);
    return results;
}
