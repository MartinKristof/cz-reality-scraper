import { log } from 'apify';

import type { OfferType } from './types.js';

export const expandOfferTypes = (offerType: OfferType): OfferType[] =>
    offerType === 'vse' ? ['prodej', 'pronajem'] : [offerType];

/** Strips the "vse" sentinel value so scrapers always receive a plain list of region names. */
export const normalizeRegions = (regions: string[]): string[] => regions.filter((r) => r !== 'vse');

export const warnInvalidRegions = (regions: string[], regionMap: Record<string, unknown>, logPrefix: string): void => {
    const normalized = normalizeRegions(regions);
    if (normalized.length === 0) return;
    const invalid = normalized.filter((region) => !regionMap[region]);
    if (invalid.length > 0) {
        log.warning(`${logPrefix} Ignoring unrecognised region names: ${invalid.join(', ')}`);
    }
};

/**
 * Identity helper kept for readability at the call sites.
 * Accepted region names are the canonical short forms defined in the input schema.
 */
export const buildRegionLookup = <T>(canonicalValues: Record<string, T>): Record<string, T> => canonicalValues;

export const calcPricePerSqm = (
    price: number | null | undefined,
    floorArea: number | null | undefined,
): number | null => (price != null && floorArea != null && floorArea > 0 ? Math.round(price / floorArea) : null);
