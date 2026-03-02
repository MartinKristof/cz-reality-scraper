import { log } from 'apify';

import { scrapeBezrealitky } from './scrapers/bezrealitky.js';
import { scrapeSreality } from './scrapers/sreality.js';
import type { Input, Listing, Portal } from './types.js';

type ScraperFn = (input: Input, maxListingsPerPortal: number) => Promise<Listing[]>;

const PORTAL_SCRAPERS: Record<Portal, ScraperFn> = {
    sreality: scrapeSreality,
    bezrealitky: scrapeBezrealitky,
};

export const scrapeAll = async (input: Input, onBatch: (listings: Listing[]) => Promise<void>): Promise<void> => {
    const maxListingsPerPortal = input.maxListings ?? Infinity;
    let total = 0;

    for (const portal of input.portals) {
        const listings = await PORTAL_SCRAPERS[portal](input, maxListingsPerPortal);
        await onBatch(listings);
        total += listings.length;
    }

    log.info(`Total listings scraped: ${total}`);
};
