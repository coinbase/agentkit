# Superfluid Action Provider

Actions are broken up by functionality:

## Superfluid Pool Action Provider
- Create pool
- Update member units

## Superfluid Stream Action Provider
- Create stream
- Update stream flow rate
- Close stream

## Superfluid Query Action Provider
- Query open streams

Query action provider is easily extendable by:
1. Adding query to `queries.ts`
2. Wrapping request in `superfluidGraphQueries.ts`
3. Creating an action in `superfluidQueryActionProvider.ts`
4. Updating `types.ts` to include the expected response format

Other chains are also easily extendable by adding the query endpoint to `endpoints.ts`