import { setTimeout } from 'node:timers/promises';

import { log } from 'apify';
import { gotScraping } from 'crawlee';

import { PAGE_DELAY_MS } from '../constants.js';
import type { Category, Input, Listing, OfferType } from '../types.js';
import { buildRegionLookup, calcPricePerSqm, expandOfferTypes, warnInvalidRegions } from '../utils.js';

const PER_PAGE = 20;
const DETAIL_API = 'https://www.sreality.cz/api/cs/v2/estates';
const SOURCE = 'sreality' as const;
const LOG_PREFIX = `[${SOURCE}]`;

const CATEGORY_MAIN: Record<Category, number> = { byty: 1, domy: 2, pozemky: 3 };
const CATEGORY_TYPE: Partial<Record<OfferType, number>> = { prodej: 1, pronajem: 2 };
const CATEGORY_SLUG: Record<Category, string> = { byty: 'byt', domy: 'dum', pozemky: 'pozemek' };

const REGION_IDS: Record<string, number> = buildRegionLookup({
    Praha: 10,
    Středočeský: 20,
    Jihočeský: 31,
    Plzeňský: 32,
    Karlovarský: 41,
    Ústecký: 42,
    Liberecký: 51,
    Královéhradecký: 52,
    Pardubický: 53,
    Vysočina: 63,
    Jihomoravský: 64,
    Olomoucký: 71,
    Zlínský: 72,
    Moravskoslezský: 80,
});

export const parseArea = (value: string | number | undefined): number | null => {
    if (value == null) return null;
    const num = Number.parseFloat(
        String(value)
            .replace(',', '.')
            .replace(/[^\d.]/g, ''),
    );
    return Number.isNaN(num) ? null : num;
};

interface DetailResult {
    layout: string | null;
    floorArea: number | null;
    landArea: number | null;
}

const fetchDetail = async (hashId: number): Promise<DetailResult> => {
    try {
        const { body: data } = (await gotScraping({
            url: `${DETAIL_API}/${hashId}`,
            responseType: 'json',
        })) as { body: Record<string, unknown> };
        const items = (Array.isArray(data.items) ? (data.items as unknown[]).flat() : []) as {
            name: string;
            value: string | number;
        }[];

        let layout: string | null = null;
        let floorArea: number | null = null;
        let landArea: number | null = null;

        for (const item of items) {
            if (typeof item !== 'object' || !item.name) continue;
            const { name, value } = item;
            const nameLower = name.toLowerCase();
            if (nameLower === 'dispozice') layout = String(value);
            else if (nameLower.includes('plocha') && !nameLower.includes('pozemku')) floorArea = parseArea(value);
            else if (nameLower.includes('pozemku')) landArea = parseArea(value);
        }

        return { layout, floorArea, landArea };
    } catch (error) {
        log.warning(`${LOG_PREFIX} Failed to fetch detail for hashId ${hashId}`, { error });
        return { layout: null, floorArea: null, landArea: null };
    }
};

export const scrapeSreality = async (input: Input, maxItems: number): Promise<Listing[]> => {
    const results: Listing[] = [];
    const offerTypes = expandOfferTypes(input.offerType);

    warnInvalidRegions(input.regions, REGION_IDS, LOG_PREFIX);

    for (const category of input.categories) {
        if (results.length >= maxItems) break;

        for (const offerType of offerTypes) {
            if (results.length >= maxItems) break;

            let page = 0;
            let totalAvailable = Infinity;

            while (results.length < maxItems && page * PER_PAGE < totalAvailable) {
                const params = new URLSearchParams({
                    category_main_cb: String(CATEGORY_MAIN[category] ?? 2),
                    per_page: String(Math.min(PER_PAGE, maxItems - results.length)),
                    page: String(page),
                });

                if (offerType in CATEGORY_TYPE) {
                    params.set('category_type_cb', String(CATEGORY_TYPE[offerType]));
                }
                if (input.maxPrice != null) {
                    params.set('czk_price_summary_order2', `0|${input.maxPrice}`);
                }
                if (input.minArea != null) {
                    params.set('usable_area', `${input.minArea}|10000`);
                }
                for (const region of input.regions) {
                    const regionId = REGION_IDS[region];
                    if (regionId) params.append('locality_region_id', String(regionId));
                }

                const url = `${DETAIL_API}?${params.toString()}`;
                log.info(`${LOG_PREFIX} Fetching page ${page} (${category}/${offerType})`, { url });

                let data: {
                    _embedded?: {
                        estates?: {
                            name: string;
                            price: number;
                            locality: string;
                            hash_id: number;
                            gps?: { lat: number; lon: number };
                            _links?: { images?: { href: string }[] };
                        }[];
                    };
                    result_size?: number;
                };

                try {
                    ({ body: data } = (await gotScraping({ url, responseType: 'json' })) as {
                        body: typeof data;
                    });
                } catch (err) {
                    log.exception(
                        err as Error,
                        `${LOG_PREFIX} Failed to fetch page ${page} (${category}/${offerType})`,
                    );
                    break;
                }

                if (page === 0) {
                    totalAvailable = data.result_size ?? Infinity;
                    log.info(`${LOG_PREFIX} Total available: ${totalAvailable} (${category}/${offerType})`);
                }

                const estates = data._embedded?.estates ?? []; // eslint-disable-line no-underscore-dangle
                if (estates.length === 0) {
                    log.warning(
                        `${LOG_PREFIX} Empty estates on page ${page} (${category}/${offerType}), result_size=${data.result_size ?? 'unknown'}`,
                    );
                    break;
                }

                for (const estate of estates) {
                    if (results.length >= maxItems) break;

                    const { name, price, locality, hash_id: hashId, gps, _links: links } = estate;
                    const rawImage = links?.images?.[0]?.href ?? null;
                    const { layout, floorArea, landArea } = await fetchDetail(hashId);
                    const pricePerSqm = calcPricePerSqm(price, floorArea);

                    results.push({
                        id: `${SOURCE}_${category}_${hashId}`,
                        source: SOURCE,
                        category,
                        name: name ?? '',
                        price: price ?? null,
                        pricePerSqm,
                        locality: locality ?? '',
                        layout,
                        floorArea,
                        landArea,
                        lat: gps?.lat ?? null,
                        lon: gps?.lon ?? null,
                        imageUrl: rawImage ?? null,
                        url: `https://www.sreality.cz/detail/${offerType}/${CATEGORY_SLUG[category]}/${hashId}`,
                    });
                }

                page++;
                await setTimeout(PAGE_DELAY_MS);
            }
        }
    }

    log.info(`${LOG_PREFIX} Done. Scraped ${results.length} listings.`);

    return results;
};
