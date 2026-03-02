import { describe, expect, it } from 'vitest';

import { resolveImage } from '../scrapers/bezrealitky.js';

const MAIN_KEY = 'url({"filter":"RECORD_MAIN"})';
const THUMB_KEY = 'url({"filter":"RECORD_THUMB"})';
const IMAGE_URL = 'https://api.bezrealitky.cz/media/cache/record_main/test.jpg';

describe('resolveImage', () => {
    it('should resolve mainImage __ref to RECORD_MAIN url', () => {
        const advert = { mainImage: { __ref: 'Image:123' } };
        const apolloState = {
            'Image:123': {
                [THUMB_KEY]: 'https://api.bezrealitky.cz/thumb.jpg',
                [MAIN_KEY]: IMAGE_URL,
            },
        };

        expect(resolveImage(advert, apolloState)).toBe(IMAGE_URL);
    });

    it('should return null when mainImage is undefined', () => {
        expect(resolveImage({}, {})).toBeNull();
    });

    it('should return null when Image ref is not in apolloState', () => {
        const advert = { mainImage: { __ref: 'Image:404' } };

        expect(resolveImage(advert, {})).toBeNull();
    });

    it('should return null when Image object has no RECORD_MAIN key', () => {
        const advert = { mainImage: { __ref: 'Image:999' } };
        const apolloState = {
            'Image:999': { [THUMB_KEY]: 'https://api.bezrealitky.cz/thumb.jpg' },
        };

        expect(resolveImage(advert, apolloState)).toBeNull();
    });
});
