import { setTimeout } from 'node:timers/promises';

import { log } from 'apify';

import { FETCH_HEADERS, PAGE_DELAY_MS } from '../constants.js';
import type { Input, Listing } from '../types.js';

const PER_PAGE = 20;
const DETAIL_API = 'https://www.sreality.cz/api/cs/v2/estates';

const CATEGORY_MAIN: Record<string, number> = { byty: 1, domy: 2, pozemky: 3 };
const CATEGORY_TYPE: Record<string, number> = { prodej: 1, pronajem: 2 };

// Maps common Czech region names to sreality locality_region_id values
const REGION_IDS: Record<string, number> = {
    Praha: 10,
    Středočeský: 20,
    'Středočeský kraj': 20,
    Jihočeský: 31,
    'Jihočeský kraj': 31,
    Plzeňský: 32,
    'Plzeňský kraj': 32,
    Karlovarský: 41,
    'Karlovarský kraj': 41,
    Ústecký: 42,
    'Ústecký kraj': 42,
    Liberecký: 51,
    'Liberecký kraj': 51,
    Královéhradecký: 52,
    'Královéhradecký kraj': 52,
    Pardubický: 53,
    'Pardubický kraj': 53,
    Vysočina: 63,
    'Kraj Vysočina': 63,
    Jihomoravský: 64,
    'Jihomoravský kraj': 64,
    Olomoucký: 71,
    'Olomoucký kraj': 71,
    Zlínský: 72,
    'Zlínský kraj': 72,
    Moravskoslezský: 80,
    'Moravskoslezský kraj': 80,
};

export function parseArea(value: string | number | undefined): number | null {
    if (value == null) return null;
    const num = parseFloat(
        String(value)
            .replace(',', '.')
            .replace(/[^\d.]/g, ''),
    );
    return Number.isNaN(num) ? null : num;
}

interface DetailResult {
    layout: string | null;
    floorArea: number | null;
    landArea: number | null;
}

async function fetchDetail(hashId: number): Promise<DetailResult> {
    try {
        const response = await fetch(`${DETAIL_API}/${hashId}`, { headers: FETCH_HEADERS });
        if (!response.ok) return { layout: null, floorArea: null, landArea: null };

        const data = (await response.json()) as Record<string, unknown>;
        const items = (Array.isArray(data.items) ? (data.items as unknown[]).flat() : []) as {
            name: string;
            value: string | number;
        }[];

        let layout: string | null = null;
        let floorArea: number | null = null;
        let landArea: number | null = null;

        for (const item of items) {
            if (typeof item !== 'object' || !item.name) continue;
            const nameLower = String(item.name).toLowerCase();
            if (nameLower === 'dispozice') layout = String(item.value);
            else if (nameLower.includes('plocha') && !nameLower.includes('pozemku')) floorArea = parseArea(item.value);
            else if (nameLower.includes('pozemku')) landArea = parseArea(item.value);
        }

        return { layout, floorArea, landArea };
    } catch {
        return { layout: null, floorArea: null, landArea: null };
    }
}

export async function scrapeSreality(input: Input, maxItems: number): Promise<Listing[]> {
    const results: Listing[] = [];
    const offerTypes = input.offerType === 'vse' ? ['prodej', 'pronajem'] : [input.offerType];

    for (const category of input.categories) {
        if (results.length >= maxItems) break;

        for (const offerType of offerTypes) {
            if (results.length >= maxItems) break;

            let page = 0;
            let totalAvailable = Infinity;

            while (results.length < maxItems && results.length < totalAvailable) {
                const params = new URLSearchParams({
                    category_main_cb: String(CATEGORY_MAIN[category] ?? 2),
                    per_page: String(Math.min(PER_PAGE, maxItems - results.length)),
                    page: String(page),
                });

                if (offerType in CATEGORY_TYPE) {
                    params.set('category_type_cb', String(CATEGORY_TYPE[offerType]));
                }
                if (input.maxPrice > 0) {
                    params.set('czk_price_summary_order2', `0|${input.maxPrice}`);
                }
                if (input.minArea > 0) {
                    params.set('usable_area', `${input.minArea}|10000`);
                }
                for (const region of input.regions) {
                    const regionId = REGION_IDS[region];
                    if (regionId) params.append('locality_region_id', String(regionId));
                }

                const url = `https://www.sreality.cz/api/cs/v2/estates?${params.toString()}`;
                log.info(`[sreality] Fetching page ${page} (${category}/${offerType})`, { url });

                let response: Response;
                try {
                    response = await fetch(url, { headers: FETCH_HEADERS });
                } catch (err) {
                    log.exception(err as Error, '[sreality] Network error');
                    break;
                }

                if (!response.ok) {
                    log.error(`[sreality] HTTP ${response.status}`, { url });
                    break;
                }

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
                    data = (await response.json()) as typeof data;
                } catch (err) {
                    log.exception(err as Error, '[sreality] Failed to parse JSON response');
                    break;
                }

                if (page === 0) {
                    totalAvailable = data.result_size ?? Infinity;
                    log.info(`[sreality] Total available: ${totalAvailable} (${category}/${offerType})`);
                }

                const estates = data._embedded?.estates ?? []; // eslint-disable-line no-underscore-dangle
                if (estates.length === 0) {
                    log.warning(
                        `[sreality] Empty estates on page ${page} (${category}/${offerType}), result_size=${data.result_size ?? 'unknown'}`,
                    );
                    break;
                }

                for (const estate of estates) {
                    if (results.length >= maxItems) break;

                    const rawImage = estate._links?.images?.[0]?.href ?? null; // eslint-disable-line no-underscore-dangle
                    const detail = await fetchDetail(estate.hash_id);
                    const pricePerSqm =
                        estate.price && detail.floorArea ? Math.round(estate.price / detail.floorArea) : null;

                    results.push({
                        id: `sreality_${estate.hash_id}`,
                        source: 'sreality',
                        name: estate.name ?? '',
                        price: estate.price ?? null,
                        pricePerSqm,
                        locality: estate.locality ?? '',
                        layout: detail.layout,
                        floorArea: detail.floorArea,
                        landArea: detail.landArea,
                        lat: estate.gps?.lat ?? null,
                        lon: estate.gps?.lon ?? null,
                        imageUrl: rawImage ? `${rawImage}?fl=res,800,600,3` : null,
                        url: `https://www.sreality.cz/detail/prodej/dum/${estate.hash_id}`,
                    });
                }

                page++;
                await setTimeout(PAGE_DELAY_MS);
            }
        }
    }

    log.info(`[sreality] Done. Scraped ${results.length} listings.`);
    return results;
}
