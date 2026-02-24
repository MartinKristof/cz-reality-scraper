export type Portal = 'sreality' | 'bezrealitky';
export type Category = 'domy' | 'byty' | 'pozemky';
export type OfferType = 'prodej' | 'pronajem' | 'vse';

export interface Input {
    portals: Portal[];
    categories: Category[];
    offerType: OfferType;
    regions: string[];
    maxPrice: number | null; // null = no limit
    minArea: number | null; // null = no limit
    maxItems: number | null; // null = no limit
    maxConcurrency: number;
    historyStoreId?: string; // named KV store for cross-run history persistence
    bestDealThreshold: number; // price/m² ≤ this fraction of run median → isBestDeal
}

export interface Listing {
    id: string; // `${source}_${category}_${hashId}`
    source: Portal;
    category: Category;
    name: string;
    price: number | null;
    pricePerSqm: number | null;
    locality: string;
    layout: string | null;
    floorArea: number | null;
    landArea: number | null;
    lat: number | null;
    lon: number | null;
    imageUrl: string | null;
    url: string;
}

export interface EnrichedListing extends Listing {
    isNew: boolean;
    priceChanged: boolean;
    previousPrice: number | null;
    daysTracked: number;
    isBestDeal: boolean;
}

export interface HistoryEntry {
    price: number | null;
    firstSeenAt: string; // ISO date
}

export type HistoryStore = Record<string, HistoryEntry>;
