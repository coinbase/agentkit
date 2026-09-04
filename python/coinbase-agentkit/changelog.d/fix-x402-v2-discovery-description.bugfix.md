Fixed x402 discovery filtering to read the description of v2 resources from the discovery API's top-level `description` field, falling back to `metadata.description` and then `accepts[].description`
