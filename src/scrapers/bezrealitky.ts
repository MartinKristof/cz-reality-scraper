import { setTimeout } from 'node:timers/promises';

import { log } from 'apify';

import { FETCH_HEADERS, PAGE_DELAY_MS } from '../constants.js';
import type { Input, Listing } from '../types.js';

// Bezrealitky.cz is a Next.js SSR app.
// Listing data is embedded in <script id="__NEXT_DATA__"> as an Apollo cache JSON — no Playwright needed.
const BASE_URL = 'https://www.bezrealitky.cz';
const PAGE_SIZE = 15;

const ESTATE_TYPE: Record<string, string> = { domy: 'dum', byty: 'byt', pozemky: 'pozemek' };
const OFFER_TYPE: Record<string, string> = { prodej: 'prodej', pronajem: 'pronajem' };

// Maps Czech region names to bezrealitky URL path slugs (verified by live fetch)
const REGION_SLUGS: Record<string, string> = {
    Praha: 'praha',
    Středočeský: 'stredocesky-kraj',
    'Středočeský kraj': 'stredocesky-kraj',
    Jihočeský: 'jihocesky-kraj',
    'Jihočeský kraj': 'jihocesky-kraj',
    Plzeňský: 'plzensky-kraj',
    'Plzeňský kraj': 'plzensky-kraj',
    Karlovarský: 'karlovarsky-kraj',
    'Karlovarský kraj': 'karlovarsky-kraj',
    Ústecký: 'ustecky-kraj',
    'Ústecký kraj': 'ustecky-kraj',
    Liberecký: 'liberecky-kraj',
    'Liberecký kraj': 'liberecky-kraj',
    Královéhradecký: 'kralovehradecky-kraj',
    'Královéhradecký kraj': 'kralovehradecky-kraj',
    Pardubický: 'pardubicky-kraj',
    'Pardubický kraj': 'pardubicky-kraj',
    Vysočina: 'kraj-vysocina',
    'Kraj Vysočina': 'kraj-vysocina',
    Jihomoravský: 'jihomoravsky-kraj',
    'Jihomoravský kraj': 'jihomoravsky-kraj',
    Olomoucký: 'olomoucky-kraj',
    'Olomoucký kraj': 'olomoucky-kraj',
    Zlínský: 'zlinsky-kraj',
    'Zlínský kraj': 'zlinsky-kraj',
    Moravskoslezský: 'moravskoslezsky-kraj',
    'Moravskoslezský kraj': 'moravskoslezsky-kraj',
};

const DISPOSITION_MAP: Record<string, string> = {
    DISP_1_KK: '1+kk',
    DISP_1_1: '1+1',
    DISP_2_KK: '2+kk',
    DISP_2_1: '2+1',
    DISP_3_KK: '3+kk',
    DISP_3_1: '3+1',
    DISP_4_KK: '4+kk',
    DISP_4_1: '4+1',
    DISP_5_KK: '5+kk',
    DISP_5_1: '5+1',
    DISP_6: '6+',
    DISP_ROOM: 'Pokoj',
};

interface ApolloAdvert {
    id?: number;
    price?: number;
    surface?: number;
    surfaceLand?: number;
    disposition?: string;
    uri?: string;
    gps?: { lat?: number; lng?: number };
    [key: string]: unknown;
}

interface PageData {
    apolloState: Record<string, unknown>;
    list: { __ref?: string }[];
    totalCount: number;
}

function extractNextData(html: string): Record<string, unknown> | null {
    const match = /<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/.exec(html);
    if (!match) return null;
    try {
        return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function getApolloState(nextData: Record<string, unknown>): Record<string, unknown> | null {
    const pageProps = (nextData as { props?: { pageProps?: Record<string, unknown> } }).props?.pageProps;
    return (pageProps?.apolloCache ?? pageProps?.apolloState ?? pageProps?.initialApolloState ?? null) as Record<
        string,
        unknown
    > | null;
}

function findByPrefix(obj: Record<string, unknown>, prefix: string): unknown {
    const key = Object.keys(obj).find((k) => k.startsWith(prefix));
    return key ? obj[key] : undefined;
}

async function fetchPageHtml(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { headers: FETCH_HEADERS });
        if (!response.ok) {
            log.error(`[bezrealitky] HTTP ${response.status}`, { url });
            return null;
        }
        return await response.text();
    } catch (err) {
        log.exception(err as Error, '[bezrealitky] Network error');
        return null;
    }
}

function parsePageData(html: string): PageData | null {
    const nextData = extractNextData(html);
    if (!nextData) {
        log.error('[bezrealitky] __NEXT_DATA__ not found in page');
        return null;
    }
    const apolloState = getApolloState(nextData);
    if (!apolloState) {
        log.error('[bezrealitky] Apollo state not found in __NEXT_DATA__');
        return null;
    }
    const rootQuery = apolloState.ROOT_QUERY as Record<string, unknown> | undefined;
    if (!rootQuery) return null;

    const listAdverts = findByPrefix(rootQuery, 'listAdverts') as
        | { list?: { __ref?: string }[]; totalCount?: number }
        | undefined;
    if (!listAdverts?.list?.length) return null;

    return { apolloState, list: listAdverts.list, totalCount: listAdverts.totalCount ?? 0 };
}

// Image: mainImage is a __ref to an Image object; resolve it then find the RECORD_MAIN url
export function resolveImage(advert: ApolloAdvert, apolloState: Record<string, unknown>): string | null {
    const mainImageRef = (advert.mainImage as { __ref?: string } | undefined)?.__ref; // eslint-disable-line no-underscore-dangle
    if (!mainImageRef) return null;
    const imageObj = apolloState[mainImageRef] as Record<string, unknown> | undefined;
    if (!imageObj) return null;
    const urlKey = Object.keys(imageObj).find((k) => k.startsWith('url') && k.includes('RECORD_MAIN'));
    return urlKey ? ((imageObj[urlKey] as string | undefined) ?? null) : null;
}

function advertToListing(
    advert: ApolloAdvert,
    apolloState: Record<string, unknown>,
    refKey: string,
    input: Input,
    offerSlug: string,
    estateSlug: string,
): Listing | null {
    if (input.maxPrice > 0 && advert.price != null && advert.price > input.maxPrice) return null;

    const floorArea = advert.surface && advert.surface > 0 ? advert.surface : null;
    if (input.minArea > 0 && (floorArea == null || floorArea < input.minArea)) return null;

    const pricePerSqm = advert.price && floorArea ? Math.round(advert.price / floorArea) : null;
    const locality = (findByPrefix(advert, 'address') as string | undefined) ?? '';
    const id = advert.id ?? refKey.replace('Advert:', '');
    const uri = typeof advert.uri === 'string' ? advert.uri : undefined;

    return {
        id: `bezrealitky_${id}`,
        source: 'bezrealitky',
        name: locality,
        price: advert.price ?? null,
        pricePerSqm,
        locality,
        layout: advert.disposition ? (DISPOSITION_MAP[advert.disposition] ?? advert.disposition) : null,
        floorArea,
        landArea: advert.surfaceLand && advert.surfaceLand > 0 ? advert.surfaceLand : null,
        lat: advert.gps?.lat ?? null,
        lon: advert.gps?.lng ?? null,
        imageUrl: resolveImage(advert, apolloState),
        url: uri ? `${BASE_URL}/${uri}` : `${BASE_URL}/vypis/nabidka-${offerSlug}/${estateSlug}`,
    };
}

function collectPageListings(
    pageData: PageData,
    input: Input,
    offerSlug: string,
    estateSlug: string,
    maxItems: number,
    results: Listing[],
): void {
    for (const ref of pageData.list) {
        if (results.length >= maxItems) break;
        const refKey = ref.__ref; // eslint-disable-line no-underscore-dangle
        if (!refKey) continue;

        const advert = pageData.apolloState[refKey] as ApolloAdvert | undefined;
        if (!advert) continue;

        const listing = advertToListing(advert, pageData.apolloState, refKey, input, offerSlug, estateSlug);
        if (listing) results.push(listing);
    }
}

interface OfferTypeContext {
    category: string;
    offerType: string;
    estateSlug: string;
    offerSlug: string;
    regionSlug?: string;
}

async function scrapeOfferType(
    ctx: OfferTypeContext,
    input: Input,
    maxItems: number,
    results: Listing[],
): Promise<void> {
    const { category, offerType, estateSlug, offerSlug, regionSlug } = ctx;
    let page = 1;
    let hasMore = true;
    const basePath = regionSlug
        ? `/vypis/nabidka-${offerSlug}/${estateSlug}/${regionSlug}`
        : `/vypis/nabidka-${offerSlug}/${estateSlug}`;

    while (hasMore && results.length < maxItems) {
        const url = `${BASE_URL}${basePath}?page=${page}`;
        const regionLabel = regionSlug ?? 'all';
        log.info(`[bezrealitky] Fetching page ${page} (${category}/${offerType}/${regionLabel})`, { url });

        const html = await fetchPageHtml(url);
        if (!html) break;

        const pageData = parsePageData(html);
        if (!pageData) break;

        if (page === 1) {
            log.info(`[bezrealitky] Total available: ${pageData.totalCount} (${category}/${offerType}/${regionLabel})`);
        }

        collectPageListings(pageData, input, offerSlug, estateSlug, maxItems, results);

        hasMore = pageData.totalCount > page * PAGE_SIZE && results.length < maxItems;
        page++;
        await setTimeout(PAGE_DELAY_MS);
    }
}

async function scrapeCategoryOffers(
    category: string,
    estateSlug: string,
    offerTypes: string[],
    regionSlugs: (string | undefined)[],
    input: Input,
    maxItems: number,
    results: Listing[],
): Promise<void> {
    for (const offerType of offerTypes) {
        if (results.length >= maxItems) break;
        const offerSlug = OFFER_TYPE[offerType];
        if (!offerSlug) continue;

        for (const regionSlug of regionSlugs) {
            if (results.length >= maxItems) break;
            await scrapeOfferType({ category, offerType, estateSlug, offerSlug, regionSlug }, input, maxItems, results);
        }
    }
}

export async function scrapeBezrealitky(input: Input, maxItems: number): Promise<Listing[]> {
    const results: Listing[] = [];
    const offerTypes = input.offerType === 'vse' ? ['prodej', 'pronajem'] : [input.offerType];
    const regionSlugs =
        input.regions.length > 0
            ? input.regions.map((r) => REGION_SLUGS[r]).filter((s): s is string => s !== undefined)
            : [undefined];

    for (const category of input.categories) {
        if (results.length >= maxItems) break;
        const estateSlug = ESTATE_TYPE[category];
        if (!estateSlug) continue;
        await scrapeCategoryOffers(category, estateSlug, offerTypes, regionSlugs, input, maxItems, results);
    }

    log.info(`[bezrealitky] Done. Scraped ${results.length} listings.`);
    return results;
}
