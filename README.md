# CZ Reality Scraper — sreality.cz + bezrealitky.cz

The only Czech real estate scraper that covers **both** sreality.cz (the largest Czech property portal, agent listings) and bezrealitky.cz (owner-direct listings, no agent fees) — in a single run with unified output. Extract property listings, monitor prices, track new listings, and analyze the Czech housing market without any coding.

## What does CZ Reality Scraper do?

CZ Reality Scraper is an Apify Actor that lets you extract structured property data from sreality.cz and bezrealitky.cz — the two dominant Czech real estate portals. Together they cover the full Czech market: sreality.cz aggregates listings from real estate agencies, while bezrealitky.cz specializes in direct owner-to-buyer listings with no agency commission.

This sreality and bezrealitky scraper can extract:

- **Houses** — family homes, villas, cottages
- **Apartments** — flats of any layout
- **Land** — building plots and agricultural land
- Listings for **sale** and/or **rent**
- Any combination of the **14 Czech regions**, from Praha to Moravskoslezský

Each listing includes price, price per m², floor area, land area, GPS coordinates, layout, image URL, and a direct link. With price history enabled, you also get `isNew`, `priceChanged`, `previousPrice`, `daysTracked`, and `priceToMedianRatio`.

## Why scrape sreality.cz and bezrealitky.cz?

Neither sreality.cz nor bezrealitky.cz offers a public API for bulk data access. A scraper is the only way to get structured Czech real estate data at scale — whether for a one-off analysis or automated daily monitoring.

Here are some ways people use this Czech real estate scraper:

- **Czech property price monitoring** — track price changes over time and detect drops on listings you're watching
- **Czech housing market analysis** — compare prices across regions, categories, and portals to understand market trends
- **Real estate investment research** — find below-median deals in Prague or any Czech region using the `priceToMedianRatio` field
- **New listing alerts** — run on a schedule and flag listings that appeared since your last run using the `isNew` field
- **Expat and international buyer research** — gather data on Praha apartments or houses in specific regions before relocating
- **Academic and journalistic research** — build a historical dataset of Czech property prices over time
- **Real estate aggregators** — build your own property search or comparison tool on top of the scraped data
- **Rental yield analysis** — compare sale prices and rental prices across Czech regions

## How to scrape Czech real estate listings

Scraping sreality.cz and bezrealitky.cz with this Actor requires no coding:

1. Click **Try for free** on the [Actor's Apify Store page](https://apify.com/TODO/cz-reality-scraper).
2. Select the **portals** you want to scrape (sreality.cz, bezrealitky.cz, or both).
3. Choose **property categories** (houses, apartments, land) and **offer type** (for sale, for rent, or both).
4. Optionally filter by **region**, **max price (CZK)**, or **min floor area (m²)**.
5. Set a **Max Listings** limit if you only need a sample.
6. Click **Run**.
7. When the run finishes, download your data from the **Dataset** tab in **JSON, CSV, or Excel** format.

## How much will it cost to scrape Czech real estate data?

Apify gives you **$5 in free credits every month** on the [Apify Free plan](https://apify.com/pricing).

CZ Reality Scraper uses pure HTTP crawling — no browser is needed — which makes it one of the most cost-efficient ways to scrape real estate data. A typical run fetching 1,000 listings costs just a few cents in platform compute. With the free monthly credits, you can run the scraper daily and collect tens of thousands of Czech property listings per month.

**Price history tracking** uses Pay-Per-Event billing: **$0.005 per enriched listing** (charged only when `enableHistory: true`). Scraping without price history is free beyond standard platform compute costs.

| Mode                        | Cost per 1 000 listings    |
| --------------------------- | -------------------------- |
| Basic scraping (no history) | ~$0.01 platform compute    |
| Price history enabled       | ~$0.01 compute + $5.00 PPE |

If you need higher volumes or continuous scheduling, check out the [Apify pricing page](https://apify.com/pricing) for subscription options.

## Input

See the **Input** tab on the [Actor's Apify Store page](https://apify.com/TODO/cz-reality-scraper/input-schema) for the full reference with descriptions and defaults.

## Output

Each scraped listing is stored as a JSON record in the Apify Dataset and can be exported to **JSON, CSV, Excel, XML, or RSS**. See the **Output** tab on the [Actor's Apify Store page](https://apify.com/TODO/cz-reality-scraper) for the full field reference.

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

## Tips for scraping Czech real estate

- **Schedule daily or weekly runs** to get the most value from price history. Enable `enableHistory: true` and set a fixed `historyStoreId` — the longer you run it, the richer the historical data.
- **Start with a region filter** when testing. Scraping Praha alone is much faster than all of Czech Republic and lets you verify the output before a full run.
- **Use `maxListings`** to cap costs and runtime during development or for quick market snapshots.
- **Combine both portals** in a single run to get full Czech market coverage — some listings appear on only one portal. Bezrealitky.cz owner-direct listings are particularly unique and not available on sreality.cz.
- **Export to CSV or Excel** for use in spreadsheets, or use the Apify API to feed the data directly into your own application.

## How it works

- **sreality.cz** — REST JSON API with server-side filtering; a detail API call per listing fetches layout and area
- **bezrealitky.cz** — SSR HTML scraping via [Crawlee](https://crawlee.dev) `CheerioCrawler`
- **Price history** — when `enableHistory: true`, history is loaded upfront from a named Apify key-value store, each portal's results are enriched and pushed immediately, and the updated history is saved at the end. Charged per enriched listing via PPE.

## Frequently asked questions

### Can I export Czech real estate data to CSV or Excel?

Yes. After a run completes, go to the **Dataset** tab and click **Export** to download your data in CSV, Excel, JSON, XML, or RSS format.

### How do I monitor new property listings automatically?

Enable **Enable Price History** (`enableHistory: true`) and set a fixed `historyStoreId`. Then schedule the Actor to run daily or weekly via the Apify Scheduler. Each run will flag newly appeared listings with `isNew: true` and price changes with `priceChanged: true`.

### What is the difference between sreality.cz and bezrealitky.cz?

Sreality.cz is the largest Czech real estate portal and aggregates listings primarily from real estate agencies. Bezrealitky.cz focuses on owner-direct listings — properties sold or rented directly by owners without an agent, so no agency commission applies. Scraping both gives you the complete picture of the Czech real estate market.

### Can I filter by Prague or a specific Czech region?

Yes. The **Regions** input lets you select any of the 14 Czech regions (Praha, Středočeský, Jihomoravský, etc.). Leave the field empty to scrape all of Czech Republic.

## Known limitations & potential improvements

### bezrealitky.cz — server-side filters

Currently `maxPrice`, `minArea`, and `regions` for bezrealitky are enforced **client-side** after fetching each page. The portal supports URL query parameters for server-side filtering (e.g. `priceTo`, `region`, `surfaceFrom`), which would reduce the number of pages fetched and avoid downloading listings that get filtered out anyway. Switching to server-side filters would be a significant efficiency improvement.

### bezrealitky.cz — `maxListings` enforcement under concurrency

The shared `results` array is guarded by an early-return check at the top of each request handler, but there is a narrow window where multiple handlers can pass the guard before any of them finishes adding items. In practice this means a small number of extra HTTP requests may still be made once the quota is nearly reached. The `results.slice(0, maxListings)` call ensures the output is always correct, but strict enforcement at the network level would require a proper atomic counter or migrating to a different concurrency model.

## Is it legal to scrape sreality.cz and bezrealitky.cz?

Property listings are publicly available information and are generally not considered personal data. That said, you should always respect the portals' Terms of Service and avoid placing excessive load on their servers.

Note that personal data is protected by GDPR in the European Union and by other regulations around the world. If any listing contains contact details or other personal data, you should not store or process it unless you have a legitimate reason to do so. If you're unsure, consult your lawyers. We also recommend reading Apify's blog post: [Is web scraping legal?](https://blog.apify.com/is-web-scraping-legal/)
