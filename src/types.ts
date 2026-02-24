export type Portal = 'sreality' | 'bezrealitky';
export type Category = 'domy' | 'byty' | 'pozemky';
export type OfferType = 'prodej' | 'pronajem' | 'vse';

export interface Input {
    portals: Portal[];
    categories: Category[];
    offerType: OfferType;
    regions: string[];
    maxPrice: number; // 0 = no limit
    minArea: number; // 0 = no limit
    maxItems: number; // 0 = no limit
}

export interface Listing {
    id: string; // `${source}_${hashId}`
    source: Portal;
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
    daysOnMarket: number;
    isBestDeal: boolean;
}

export interface HistoryEntry {
    price: number | null;
    firstSeenAt: string; // ISO date
}

export type HistoryStore = Record<string, HistoryEntry>;
