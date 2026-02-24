export const PAGE_DELAY_MS = 500;

export const INPUT_DEFAULTS = {
    portals: ['sreality' as const],
    categories: ['domy' as const],
    offerType: 'prodej' as const,
    regions: [] as string[],
    maxPrice: null as number | null,
    minArea: null as number | null,
    maxItems: 100,
    maxConcurrency: 5,
    bestDealThreshold: 0.85,
};

export const LISTING_HISTORY_KEY = 'LISTING_HISTORY';
