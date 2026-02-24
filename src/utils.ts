export function calcPerPortal(maxItems: number, portalCount: number): number {
    const effectiveMax = maxItems === 0 ? Infinity : maxItems;
    return effectiveMax === Infinity ? Infinity : Math.ceil(effectiveMax / portalCount);
}
