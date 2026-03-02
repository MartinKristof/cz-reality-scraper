import { log } from 'apify';
import { CheerioCrawler, type RequestOptions } from 'crawlee';

import { MAX_CONCURRENCY } from '../constants.js';
import type { Category, Input, Listing, OfferType } from '../types.js';
import { buildRegionLookup, calcPricePerSqm, createTieredProxyConfig, warnInvalidRegions } from '../utils.js';

// Bezrealitky.cz is a Next.js SSR app.
// Listing data is embedded in <script id="__NEXT_DATA__"> as an Apollo cache JSON — no Playwright needed.
const BASE_URL = 'https://www.bezrealitky.cz';
const PAGE_SIZE = 15;
const SOURCE = 'bezrealitky' as const;
const LOG_PREFIX = `[${SOURCE}]`;
const LISTING_URL_BASE = '/vypis/nabidka-';

const ESTATE_TYPE: Record<Category, string> = { domy: 'dum', byty: 'byt', pozemky: 'pozemek' };
const OFFER_TYPE: Partial<Record<OfferType, string>> = { prodej: 'prodej', pronajem: 'pronajem' };

// Maps Czech region names to bezrealitky URL path slugs (verified by live fetch)
const REGION_SLUGS: Record<string, string> = buildRegionLookup({
    Praha: 'praha',
    Středočeský: 'stredocesky-kraj',
    Jihočeský: 'jihocesky-kraj',
    Plzeňský: 'plzensky-kraj',
    Karlovarský: 'karlovarsky-kraj',
    Ústecký: 'ustecky-kraj',
    Liberecký: 'liberecky-kraj',
    Královéhradecký: 'kralovehradecky-kraj',
    Pardubický: 'pardubicky-kraj',
    Vysočina: 'kraj-vysocina',
    Jihomoravský: 'jihomoravsky-kraj',
    Olomoucký: 'olomoucky-kraj',
    Zlínský: 'zlinsky-kraj',
    Moravskoslezský: 'moravskoslezsky-kraj',
});

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

interface PageUserData {
    category: Category;
    offerType: OfferType;
    estateSlug: string;
    offerSlug: string;
    regionSlug: string | undefined;
    page: number;
}

const getApolloState = (nextData: Record<string, unknown>): Record<string, unknown> | null => {
    const { props } = nextData as { props?: { pageProps?: Record<string, unknown> } };
    const pageProps = props?.pageProps;

    return (pageProps?.apolloCache ?? pageProps?.apolloState ?? pageProps?.initialApolloState ?? null) as Record<
        string,
        unknown
    > | null;
};

const findByPrefix = (obj: Record<string, unknown>, prefix: string): unknown => {
    const matchedKey = Object.keys(obj).find((key) => key.startsWith(prefix));

    return matchedKey ? obj[matchedKey] : undefined;
};

const parseNextDataScript = (raw: string): PageData | null => {
    let nextData: Record<string, unknown>;
    try {
        nextData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
        log.error(`${LOG_PREFIX} Failed to parse __NEXT_DATA__ JSON`);
        return null;
    }

    const apolloState = getApolloState(nextData);
    if (!apolloState) {
        log.error(`${LOG_PREFIX} Apollo state not found in __NEXT_DATA__`);
        return null;
    }

    const rootQuery = apolloState.ROOT_QUERY as Record<string, unknown> | undefined;
    if (!rootQuery) return null;

    const listAdverts = findByPrefix(rootQuery, 'listAdverts') as
        | { list?: { __ref?: string }[]; totalCount?: number }
        | undefined;
    if (!listAdverts?.list?.length) return null;

    return { apolloState, list: listAdverts.list, totalCount: listAdverts.totalCount ?? 0 };
};

// Image: mainImage is a __ref to an Image object; resolve it then find the RECORD_MAIN url
export const resolveImage = (advert: ApolloAdvert, apolloState: Record<string, unknown>): string | null => {
    const { __ref: mainImageRef } = (advert.mainImage as { __ref?: string } | undefined) ?? {};
    if (!mainImageRef) return null;

    const imageObj = apolloState[mainImageRef] as Record<string, unknown> | undefined;
    if (!imageObj) return null;

    const urlKey = Object.keys(imageObj).find((key) => key.startsWith('url') && key.includes('RECORD_MAIN'));

    return urlKey ? ((imageObj[urlKey] as string | undefined) ?? null) : null;
};

const buildListingPath = (offerSlug: string, estateSlug: string, regionSlug?: string): string =>
    regionSlug
        ? `${LISTING_URL_BASE}${offerSlug}/${estateSlug}/${regionSlug}`
        : `${LISTING_URL_BASE}${offerSlug}/${estateSlug}`;

const advertToListing = (
    advert: ApolloAdvert,
    apolloState: Record<string, unknown>,
    refKey: string,
    input: Input,
    category: Category,
    offerSlug: string,
    estateSlug: string,
): Listing | null => {
    const { id: advertId, price, surface, surfaceLand, disposition, uri: rawUrlPath, gps } = advert;
    const maxPrice = input.maxPrice ?? Infinity;
    const minArea = input.minArea ?? 0;

    if (price != null && price > maxPrice) return null;

    const floorArea = surface && surface > 0 ? surface : null;
    if (minArea > 0 && (floorArea == null || floorArea < minArea)) return null;

    const pricePerSqm = calcPricePerSqm(price, floorArea);
    const locality = (findByPrefix(advert, 'address') as string | undefined) ?? '';
    const id = advertId ?? refKey.replace('Advert:', '');
    const urlPath = typeof rawUrlPath === 'string' ? rawUrlPath : undefined;

    return {
        id: `${SOURCE}_${category}_${id}`,
        source: SOURCE,
        category,
        name: locality,
        price: price ?? null,
        pricePerSqm,
        locality,
        layout: disposition ? (DISPOSITION_MAP[disposition] ?? disposition) : null,
        floorArea,
        landArea: surfaceLand && surfaceLand > 0 ? surfaceLand : null,
        lat: gps?.lat ?? null,
        lon: gps?.lng ?? null,
        imageUrl: resolveImage(advert, apolloState),
        url: urlPath ? `${BASE_URL}/${urlPath}` : `${BASE_URL}${buildListingPath(offerSlug, estateSlug)}`,
    };
};

const collectPageListings = (
    pageData: PageData,
    input: Input,
    category: Category,
    offerSlug: string,
    estateSlug: string,
    maxListings: number,
    results: Listing[],
): void => {
    for (const ref of pageData.list) {
        if (results.length >= maxListings) break;
        const { __ref: refKey } = ref;
        if (!refKey) continue;

        const advert = pageData.apolloState[refKey] as ApolloAdvert | undefined;
        if (!advert) continue;

        const listing = advertToListing(advert, pageData.apolloState, refKey, input, category, offerSlug, estateSlug);
        if (listing) results.push(listing);
    }
};

const buildPageUrl = (offerSlug: string, estateSlug: string, regionSlug: string | undefined, page: number): string =>
    `${BASE_URL}${buildListingPath(offerSlug, estateSlug, regionSlug)}?page=${page}`;

export const scrapeBezrealitky = async (input: Input, maxListings: number): Promise<Listing[]> => {
    const results: Listing[] = [];
    const offerTypes = input.offerType;
    const normalizedRegions = input.regions;
    const regionSlugs =
        normalizedRegions.length > 0
            ? normalizedRegions
                  .map((regionName) => REGION_SLUGS[regionName])
                  .filter((slug): slug is string => slug !== undefined)
            : [undefined];

    warnInvalidRegions(input.regions, REGION_SLUGS, LOG_PREFIX);
    if (input.regions.length > 0 && regionSlugs.length === 0) {
        log.warning(`${LOG_PREFIX} All provided regions are invalid — no listings will be scraped.`);
        return results;
    }

    const startRequests: RequestOptions<PageUserData>[] = [];
    for (const category of input.categories) {
        const estateSlug = ESTATE_TYPE[category];
        if (!estateSlug) continue;
        for (const offerType of offerTypes) {
            const offerSlug = OFFER_TYPE[offerType];
            if (!offerSlug) continue;
            for (const regionSlug of regionSlugs) {
                startRequests.push({
                    url: buildPageUrl(offerSlug, estateSlug, regionSlug, 1),
                    userData: { category, offerType, estateSlug, offerSlug, regionSlug, page: 1 },
                });
            }
        }
    }

    const proxyConfiguration = await createTieredProxyConfig();

    const crawler = new CheerioCrawler({
        proxyConfiguration,
        maxConcurrency: MAX_CONCURRENCY,
        async requestHandler({ request, $, crawler: crawlerInstance }) {
            if (results.length >= maxListings) return;

            const { category, offerType, estateSlug, offerSlug, regionSlug, page } = request.userData as PageUserData;
            const regionLabel = regionSlug ?? 'all';

            log.info(`${LOG_PREFIX} Fetching page ${page} (${category}/${offerType}/${regionLabel})`, {
                url: request.url,
            });

            const nextDataRaw = $('script[id="__NEXT_DATA__"]').html();
            if (!nextDataRaw) {
                log.error(`${LOG_PREFIX} __NEXT_DATA__ not found in page`, { url: request.url });
                return;
            }

            const pageData = parseNextDataScript(nextDataRaw);
            if (!pageData) return;

            if (page === 1) {
                log.info(
                    `${LOG_PREFIX} Total available: ${pageData.totalCount} (${category}/${offerType}/${regionLabel})`,
                );
            }

            collectPageListings(pageData, input, category, offerSlug, estateSlug, maxListings, results);

            const shouldOpenNextPage = pageData.totalCount > page * PAGE_SIZE && results.length < maxListings;
            if (shouldOpenNextPage) {
                const nextPage = page + 1;
                await crawlerInstance.addRequests([
                    {
                        url: buildPageUrl(offerSlug, estateSlug, regionSlug, nextPage),
                        userData: { category, offerType, estateSlug, offerSlug, regionSlug, page: nextPage },
                    } as RequestOptions<PageUserData>,
                ]);
            }
        },
    });

    await crawler.run(startRequests);

    const capped = results.slice(0, maxListings);
    log.info(`${LOG_PREFIX} Done. Scraped ${capped.length} listings.`);

    return capped;
};
