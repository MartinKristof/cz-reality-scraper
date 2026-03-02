import { Actor, log } from 'apify';

export const warnInvalidRegions = (regions: string[], regionMap: Record<string, unknown>, logPrefix: string): void => {
    if (regions.length === 0) return;
    const invalid = regions.filter((region) => !regionMap[region]);
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

export const createTieredProxyConfig = async () =>
    Actor.createProxyConfiguration({
        tieredProxyConfig: [{}, { groups: ['RESIDENTIAL'] }],
    });
