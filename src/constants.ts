export const PAGE_DELAY_MS = 500;

export const INPUT_DEFAULTS = {
    portals: ['sreality' as const],
    categories: ['domy' as const],
    offerType: 'prodej' as const,
    regions: [] as string[],
    maxPrice: 0,
    minArea: 0,
    maxItems: 100,
};

export const LISTING_HISTORY_KEY = 'LISTING_HISTORY';

export const BEST_DEAL_THRESHOLD = 0.85;

export const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; ApifyBot/1.0; +https://apify.com)',
    Accept: 'application/json',
    Referer: 'https://www.sreality.cz/',
};
