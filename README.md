# CZ Reality Scraper — sreality + bezrealitky

Scrapes property listings from **sreality.cz** and **bezrealitky.cz**. Supports filtering by portal, category, region, price, and floor area. Tracks price history between runs and flags new listings, price drops, and best deals.

## Features

- **Two portals** — sreality.cz and bezrealitky.cz in a single run
- **Categories** — houses (`domy`), flats (`byty`), land (`pozemky`)
- **Offer types** — for sale, for rent, or both
- **Region filter** — server-side filtering by any of the 14 Czech regions (no post-processing waste)
- **Price & area filters** — max price (CZK) and min floor area (m²)
- **Price history** — persisted in a named Apify key-value store across runs; each listing shows `priceChanged`, `previousPrice`, and `daysTracked`
- **Best deal detection** — `isBestDeal: true` when a listing's price/m² is at or below `bestDealThreshold` × the median price/m² of all listings scraped in the same run
- **GPS coordinates** — `lat`/`lon` included where available (sreality)
- **Image URLs** — full-resolution image link per listing

## Input

| Field               | Type       | Default        | Description                                              |
| ------------------- | ---------- | -------------- | -------------------------------------------------------- |
| `portals`           | `string[]` | `["sreality"]` | Portals to scrape: `"sreality"`, `"bezrealitky"`         |
| `categories`        | `string[]` | `["domy"]`     | Property types: `"domy"`, `"byty"`, `"pozemky"`          |
| `offerType`         | `string`   | `"prodej"`     | `"prodej"` (sale), `"pronajem"` (rent), `"vse"` (all)    |
| `regions`           | `string[]` | `[]`           | Czech regions to filter by; empty = whole Czech Republic |
| `maxPrice`          | `integer`  | `null`         | Max price in CZK; `null` = no limit                      |
| `minArea`           | `integer`  | `null`         | Min floor area in m²; `null` = no limit                  |
| `maxItems`          | `integer`  | `100`          | Max total listings across all portals; `null` = no limit |
| `maxConcurrency`    | `integer`  | `5`            | Max concurrent HTTP requests per portal crawler (1–50)   |
| `historyStoreId`    | `string`   | `""`           | Named KV store for cross-run price history (empty = off) |
| `bestDealThreshold` | `number`   | `0.85`         | isBestDeal: price/m² ≤ run-median × threshold (0.85=15%) |

### Valid region values

Both short and long forms are accepted (e.g. `"Jihomoravský"` or `"Jihomoravský kraj"`). Multiple regions can be combined.

| Short form        | Long form              |
| ----------------- | ---------------------- |
| `Praha`           | —                      |
| `Středočeský`     | `Středočeský kraj`     |
| `Jihočeský`       | `Jihočeský kraj`       |
| `Plzeňský`        | `Plzeňský kraj`        |
| `Karlovarský`     | `Karlovarský kraj`     |
| `Ústecký`         | `Ústecký kraj`         |
| `Liberecký`       | `Liberecký kraj`       |
| `Královéhradecký` | `Královéhradecký kraj` |
| `Pardubický`      | `Pardubický kraj`      |
| `Vysočina`        | `Kraj Vysočina`        |
| `Jihomoravský`    | `Jihomoravský kraj`    |
| `Olomoucký`       | `Olomoucký kraj`       |
| `Zlínský`         | `Zlínský kraj`         |
| `Moravskoslezský` | `Moravskoslezský kraj` |

### Example input

```json
{
    "portals": ["sreality", "bezrealitky"],
    "categories": ["domy"],
    "offerType": "prodej",
    "regions": ["Jihomoravský"],
    "maxPrice": 8000000,
    "minArea": 100,
    "maxItems": 200,
    "historyStoreId": "my-reality-history"
}
```

## Output

Each item pushed to the dataset:

| Field           | Type           | Description                               |
| --------------- | -------------- | ----------------------------------------- |
| `id`            | `string`       | Unique ID, e.g. `sreality_domy_1234567`   |
| `source`        | `string`       | `"sreality"` or `"bezrealitky"`           |
| `category`      | `string`       | `"domy"`, `"byty"`, or `"pozemky"`        |
| `name`          | `string`       | Listing title                             |
| `price`         | `number\|null` | Price in CZK                              |
| `pricePerSqm`   | `number\|null` | Price per m² (rounded)                    |
| `locality`      | `string`       | Location string                           |
| `layout`        | `string\|null` | Room layout, e.g. `"4+kk"`                |
| `floorArea`     | `number\|null` | Usable floor area in m²                   |
| `landArea`      | `number\|null` | Land area in m² (houses/land)             |
| `lat`           | `number\|null` | Latitude                                  |
| `lon`           | `number\|null` | Longitude                                 |
| `imageUrl`      | `string\|null` | Main listing image URL                    |
| `url`           | `string`       | Link to the listing                       |
| `isNew`         | `boolean`      | `true` on first appearance                |
| `priceChanged`  | `boolean`      | `true` if price changed since last run    |
| `previousPrice` | `number\|null` | Previous price in CZK                     |
| `daysTracked`   | `number`       | Days since first seen by this Actor       |
| `isBestDeal`    | `boolean`      | `true` if price/m² ≤ run-median×threshold |

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
    "isBestDeal": true
}
```

## How it works

- **sreality.cz** — REST JSON API with server-side filtering; a detail API call per listing fetches layout and area
- **bezrealitky.cz** — SSR HTML scraping via [Crawlee](https://crawlee.dev) `CheerioCrawler`
- **Price history** — stored in a named Apify key-value store (set via `historyStoreId`); enriches each listing with `isNew`, `priceChanged`, `daysTracked`, and `isBestDeal`

## Local development

```bash
# Install dependencies
npm install

# Run locally (reads input from storage/key_value_stores/default/INPUT.json)
apify run

# Run tests
npm test

# Build TypeScript
npm run build
```

## Deploy to Apify

```bash
apify login   # authenticate with your Apify account
apify push    # build and deploy to the Apify platform
```

## Known limitations & potential improvements

### bezrealitky.cz — server-side filters

Currently `maxPrice`, `minArea`, and `regions` for bezrealitky are enforced **client-side** after fetching each page. The portal supports URL query parameters for server-side filtering (e.g. `priceTo`, `region`, `surfaceFrom`), which would reduce the number of pages fetched and avoid downloading listings that get filtered out anyway. Switching to server-side filters would be a significant efficiency improvement.

### bezrealitky.cz — `maxItems` enforcement under concurrency

The shared `results` array is guarded by an early-return check at the top of each request handler, but there is a narrow window where multiple handlers can pass the guard before any of them finishes adding items. In practice this means a small number of extra HTTP requests may still be made once the quota is nearly reached. The `results.slice(0, maxItems)` call ensures the output is always correct, but strict enforcement at the network level would require a proper atomic counter or migrating to a different concurrency model.

## Scheduling tip

Run this Actor on a daily or weekly schedule to benefit from price history tracking. To persist history across runs, set `historyStoreId` to any fixed name (e.g. `"my-reality-history"`) — Apify will create the named store on first run and reuse it on every subsequent run. Without a `historyStoreId` each run starts fresh (default key-value store is ephemeral). On each run the Actor loads the previous history, computes `priceChanged` and `daysTracked`, then saves the updated history back — the longer you run it, the richer the data.
