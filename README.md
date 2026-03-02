# CZ Reality Scraper — sreality + bezrealitky

Scrapes property listings from **sreality.cz** and **bezrealitky.cz**. Supports filtering by portal, category, region, price, and floor area. Optionally tracks price history between runs and flags new listings and price drops.

## Features

- **Two portals** — sreality.cz and bezrealitky.cz in a single run with unified interface and output shape
- **Categories** — houses (`domy`), flats (`byty`), land (`pozemky`)
- **Offer types** — for sale, for rent, or both
- **Region filter** — sreality.cz: server-side filtering by any of the 14 Czech regions (no post-processing waste); bezrealitky.cz: client-side after fetching pages
- **Price & area filters** — max price (CZK) and min floor area (m²)
- **Price history** _(optional, charged per listing)_ — persisted in an Apify key-value store across runs; each listing shows `isNew`, `priceChanged`, `previousPrice`, and `daysTracked`
- **Price-to-median ratio** _(with history)_ — each listing gets a `priceToMedianRatio` field (price/m² ÷ run median); values below 1.0 indicate a below-median deal
- **GPS coordinates** — `lat`/`lon` included where available (sreality)
- **Image URLs** — full-resolution image link per listing

## Input

See the **Input** tab on the [Actor's Apify Store page](https://apify.com/TODO/cz-reality-scraper/input-schema) for the full reference with descriptions and defaults.

## Output

See the **Output** tab on the [Actor's Apify Store page](https://apify.com/TODO/cz-reality-scraper) for the full field reference.

### Example output record

```json
{
    "id": "sreality_domy_1234567",
    "source": "sreality",
    "name": "Prodej rodinného domu 4+kk, 150 m²",
    "price": 5900000,
    "pricePerSqm": 39333,
    "locality": "Brno-Líšeň",
    "layout": "4+kk",
    "floorArea": 150,
    "landArea": 420,
    "lat": 49.2183,
    "lon": 16.6512,
    "imageUrl": "https://d18-a.sdn.cz/d_18/c_img_G_E/abc.jpg?fl=res,800,600,3",
    "url": "https://www.sreality.cz/detail/prodej/dum/1234567",
    "isNew": false,
    "priceChanged": true,
    "previousPrice": 6200000,
    "daysTracked": 14,
    "priceToMedianRatio": 0.8
}
```

## How it works

- **sreality.cz** — REST JSON API with server-side filtering; a detail API call per listing fetches layout and area
- **bezrealitky.cz** — SSR HTML scraping via [Crawlee](https://crawlee.dev) `CheerioCrawler`
- **Price history** — when `enableHistory: true`, history is loaded upfront from a named Apify key-value store, each portal's results are enriched and pushed immediately, and the updated history is saved at the end. Charged per enriched listing via PPE.

## Scheduling tip

Run this Actor on a daily or weekly schedule to benefit from price history tracking. Enable `enableHistory: true` and set `historyStoreId` to any fixed name (e.g. `"my-reality-history"`) — Apify will create the named store on first run and reuse it on every subsequent run. The longer you run it, the richer the data.

## Known limitations & potential improvements

### bezrealitky.cz — server-side filters

Currently `maxPrice`, `minArea`, and `regions` for bezrealitky are enforced **client-side** after fetching each page. The portal supports URL query parameters for server-side filtering (e.g. `priceTo`, `region`, `surfaceFrom`), which would reduce the number of pages fetched and avoid downloading listings that get filtered out anyway. Switching to server-side filters would be a significant efficiency improvement.

### bezrealitky.cz — `maxListings` enforcement under concurrency

The shared `results` array is guarded by an early-return check at the top of each request handler, but there is a narrow window where multiple handlers can pass the guard before any of them finishes adding items. In practice this means a small number of extra HTTP requests may still be made once the quota is nearly reached. The `results.slice(0, maxListings)` call ensures the output is always correct, but strict enforcement at the network level would require a proper atomic counter or migrating to a different concurrency model.
