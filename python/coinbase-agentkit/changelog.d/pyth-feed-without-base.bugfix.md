Fixed the Pyth `fetch_price_feed` action raising a KeyError now that Hermes no longer returns `attributes.base`, by falling back to the base asset in the feed symbol
