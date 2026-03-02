export type Portal = 'sreality' | 'bezrealitky';
export type Category = 'domy' | 'byty' | 'pozemky';
export type OfferType = 'prodej' | 'pronajem';

export interface Input {
    portals: Portal[];
    categories: Category[];
    offerType: OfferType[];
    regions: string[];
    maxPrice?: number | null; // undefined/null = no limit
    minArea?: number | null; // undefined/null = no limit
    maxListings?: number | null; // undefined/null = no limit
    enableHistory?: boolean; // enable cross-run price history tracking (PPE charged)
    historyStoreId?: string; // optional: custom named KV store for history persistence
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
    priceToMedianRatio: number | null;
}

export interface HistoryEntry {
    price: number | null;
    firstSeenAt: string; // ISO date
}

export type HistoryStore = Record<string, HistoryEntry>;
