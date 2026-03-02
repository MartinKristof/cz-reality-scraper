import { setTimeout } from 'node:timers/promises';

import { Actor, log } from 'apify';
import { gotScraping, HttpCrawler, type RequestOptions } from 'crawlee';

import { MAX_CONCURRENCY, PAGE_DELAY_MS } from '../constants.js';
import type { Category, Input, Listing, OfferType } from '../types.js';
import {
    buildRegionLookup,
    calcPricePerSqm,
    expandOfferTypes,
    normalizeRegions,
    warnInvalidRegions,
} from '../utils.js';

const PER_PAGE = 20;
const AREA_MAX = 1_000_000; // 1 000 000 m² upper bound for usable_area filter (covers any land plot)
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

interface ListingPageUserData {
    category: Category;
    offerType: OfferType;
    page: number;
}

interface SrealityEstate {
    name: string;
    price: number;
    locality: string;
    hash_id: number;
    gps?: { lat: number; lon: number };
    _links?: { images?: { href: string }[] };
}

interface SrealityResponse {
    _embedded?: { estates?: SrealityEstate[] };
    result_size?: number;
}

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

const fetchDetail = async (hashId: number, proxyUrl?: string): Promise<DetailResult> => {
    try {
        const { body: data } = (await gotScraping({
            url: `${DETAIL_API}/${hashId}`,
            responseType: 'json',
            proxyUrl,
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

const buildListingUrl = (category: Category, offerType: OfferType, page: number, input: Input): string => {
    const params = new URLSearchParams({
        category_main_cb: String(CATEGORY_MAIN[category] ?? 2),
        per_page: String(PER_PAGE),
        page: String(page),
    });
    if (offerType in CATEGORY_TYPE) {
        params.set('category_type_cb', String(CATEGORY_TYPE[offerType]));
    }
    if (input.maxPrice != null) {
        params.set('czk_price_summary_order2', `0|${input.maxPrice}`);
    }
    if (input.minArea != null) {
        params.set('usable_area', `${input.minArea}|${AREA_MAX}`);
    }
    for (const region of normalizeRegions(input.regions)) {
        const regionId = REGION_IDS[region];
        if (regionId) params.append('locality_region_id', String(regionId));
    }
    return `${DETAIL_API}?${params.toString()}`;
};

export const scrapeSreality = async (input: Input, maxListings: number): Promise<Listing[]> => {
    const results: Listing[] = [];
    const offerTypes = expandOfferTypes(input.offerType);
    const proxyConfiguration = await Actor.createProxyConfiguration(
        input.proxyConfiguration ?? { useApifyProxy: true },
    );

    warnInvalidRegions(input.regions, REGION_IDS, LOG_PREFIX);

    const startRequests: RequestOptions<ListingPageUserData>[] = [];
    for (const category of input.categories) {
        for (const offerType of offerTypes) {
            startRequests.push({
                url: buildListingUrl(category, offerType, 0, input),
                userData: { category, offerType, page: 0 },
            } as RequestOptions<ListingPageUserData>);
        }
    }

    const crawler = new HttpCrawler({
        proxyConfiguration,
        maxConcurrency: MAX_CONCURRENCY,
        additionalMimeTypes: ['application/hal+json'],
        async requestHandler({ request, body, crawler: crawlerInstance }) {
            if (results.length >= maxListings) return;

            const { category, offerType, page } = request.userData as ListingPageUserData;

            log.info(`${LOG_PREFIX} Fetching page ${page} (${category}/${offerType})`, { url: request.url });

            const data = JSON.parse(body.toString()) as SrealityResponse;

            if (page === 0) {
                log.info(`${LOG_PREFIX} Total available: ${data.result_size ?? 0} (${category}/${offerType})`);
            }

            const estates = data._embedded?.estates ?? []; // eslint-disable-line no-underscore-dangle
            if (estates.length === 0) {
                log.warning(
                    `${LOG_PREFIX} Empty estates on page ${page} (${category}/${offerType}), result_size=${data.result_size ?? 'unknown'}`,
                );
                return;
            }

            for (const estate of estates) {
                if (results.length >= maxListings) break;

                const { name, price, locality, hash_id: hashId, gps, _links: links } = estate;
                const rawImage = links?.images?.[0]?.href ?? null;
                const detailProxyUrl = await proxyConfiguration?.newUrl(String(hashId));
                const { layout, floorArea, landArea } = await fetchDetail(hashId, detailProxyUrl);
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

            const shouldOpenNextPage = (data.result_size ?? 0) > (page + 1) * PER_PAGE && results.length < maxListings;
            if (shouldOpenNextPage) {
                const nextPage = page + 1;
                await crawlerInstance.addRequests([
                    {
                        url: buildListingUrl(category, offerType, nextPage, input),
                        userData: { category, offerType, page: nextPage },
                    } as RequestOptions<ListingPageUserData>,
                ]);
            }

            await setTimeout(PAGE_DELAY_MS);
        },
    });

    await crawler.run(startRequests);

    log.info(`${LOG_PREFIX} Done. Scraped ${results.length} listings.`);

    return results;
};
