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

/** Canonical Czech region name → all accepted input aliases (including the canonical name itself) */
const CZECH_REGION_ALIASES: Record<string, string[]> = {
    Praha: ['Praha'],
    Středočeský: ['Středočeský', 'Středočeský kraj'],
    Jihočeský: ['Jihočeský', 'Jihočeský kraj'],
    Plzeňský: ['Plzeňský', 'Plzeňský kraj'],
    Karlovarský: ['Karlovarský', 'Karlovarský kraj'],
    Ústecký: ['Ústecký', 'Ústecký kraj'],
    Liberecký: ['Liberecký', 'Liberecký kraj'],
    Královéhradecký: ['Královéhradecký', 'Královéhradecký kraj'],
    Pardubický: ['Pardubický', 'Pardubický kraj'],
    Vysočina: ['Vysočina', 'Kraj Vysočina'],
    Jihomoravský: ['Jihomoravský', 'Jihomoravský kraj'],
    Olomoucký: ['Olomoucký', 'Olomoucký kraj'],
    Zlínský: ['Zlínský', 'Zlínský kraj'],
    Moravskoslezský: ['Moravskoslezský', 'Moravskoslezský kraj'],
};

/**
 * Builds a region lookup map that accepts both canonical and alias region names.
 * Pass a canonical-name → portal-value map; the result includes all accepted aliases.
 */
export const buildRegionLookup = <T>(canonicalValues: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
        Object.entries(CZECH_REGION_ALIASES).flatMap(([canonical, aliases]) => {
            const value = canonicalValues[canonical];
            if (value === undefined) return [];
            return aliases.map((alias) => [alias, value]);
        }),
    );

export const calcPricePerSqm = (
    price: number | null | undefined,
    floorArea: number | null | undefined,
): number | null => (price && floorArea ? Math.round(price / floorArea) : null);
