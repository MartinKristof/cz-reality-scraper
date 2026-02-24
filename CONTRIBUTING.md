# Contributing

## Local development

```bash
# Install dependencies
npm install

# Set up local environment variables (copy and fill in your Apify token)
cp .env.example .env

# Run locally (reads input from storage/key_value_stores/default/INPUT.json)
apify run

# Run tests
npm test

# Build TypeScript
npm run build
```

The `.env` file enables PPE simulation locally — `Actor.charge()` calls are logged to `storage/datasets/charging_log/` (all events default to $1 in local mode).

## Deploy to Apify

```bash
apify login   # authenticate with your Apify account
apify push    # build and deploy to the Apify platform
```
