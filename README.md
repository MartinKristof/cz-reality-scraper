# CZ Reality Scraper — sreality + bezrealitky

Scrapes property listings from **sreality.cz** and **bezrealitky.cz**. Supports filtering by portal, category, region, price, and floor area. Tracks price history between runs and flags new listings, price drops, and best deals.

## Features

- **Two portals** — sreality.cz and bezrealitky.cz in a single run
- **Categories** — houses (`domy`), flats (`byty`), land (`pozemky`)
- **Offer types** — for sale, for rent, or both
- **Region filter** — server-side filtering by any of the 14 Czech regions (no post-processing waste)
- **Price & area filters** — max price (CZK) and min floor area (m²)
- **Price history** — stored in key-value store between runs; each listing shows `priceChanged`, `previousPrice`, and `daysOnMarket`
- **Best deal detection** — `isBestDeal: true` when a listing's price/m² is ≥ 15 % below the median for that run
- **GPS coordinates** — `lat`/`lon` included where available (sreality)
- **Image URLs** — full-resolution image link per listing

## Input

| Field        | Type       | Default        | Description                                              |
| ------------ | ---------- | -------------- | -------------------------------------------------------- |
| `portals`    | `string[]` | `["sreality"]` | Portals to scrape: `"sreality"`, `"bezrealitky"`         |
| `categories` | `string[]` | `["domy"]`     | Property types: `"domy"`, `"byty"`, `"pozemky"`          |
| `offerType`  | `string`   | `"prodej"`     | `"prodej"` (sale), `"pronajem"` (rent), `"vse"` (all)    |
| `regions`    | `string[]` | `[]`           | Czech regions to filter by; empty = whole Czech Republic |
| `maxPrice`   | `integer`  | `0`            | Max price in CZK; `0` = no limit                         |
| `minArea`    | `integer`  | `0`            | Min floor area in m²; `0` = no limit                     |
| `maxItems`   | `integer`  | `100`          | Max total listings across all portals; `0` = no limit    |

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
    "maxItems": 200
}
```

## Output

Each item pushed to the dataset:

| Field           | Type           | Description                               |
| --------------- | -------------- | ----------------------------------------- |
| `id`            | `string`       | Unique ID, e.g. `sreality_1234567`        |
| `source`        | `string`       | `"sreality"` or `"bezrealitky"`           |
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
| `daysOnMarket`  | `number`       | Days since first seen                     |
| `isBestDeal`    | `boolean`      | `true` if price/m² is ≥ 15 % below median |

### Example output record

```json
{
    "id": "sreality_1234567",
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
    "daysOnMarket": 14,
    "isBestDeal": true
}
```

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

## Scheduling tip

Run this Actor on a daily or weekly schedule to benefit from price history tracking. On each run, the Actor loads the previous run's history from the key-value store, computes `priceChanged` and `daysOnMarket`, and saves updated history back — so the longer you run it, the richer the data.
