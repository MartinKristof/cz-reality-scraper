import { describe, expect, it } from 'vitest';

import { calcPerPortal } from '../utils.js';

describe('calcPerPortal', () => {
    it('distributes evenly across portals', () => {
        expect(calcPerPortal(100, 2)).toBe(50);
    });

    it('rounds up when not evenly divisible', () => {
        expect(calcPerPortal(100, 3)).toBe(34);
    });

    it('returns Infinity when maxItems is 0 (no limit)', () => {
        expect(calcPerPortal(0, 2)).toBe(Infinity);
    });

    it('returns Infinity for a single portal with no limit', () => {
        expect(calcPerPortal(0, 1)).toBe(Infinity);
    });

    it('handles a single portal', () => {
        expect(calcPerPortal(50, 1)).toBe(50);
    });
});
