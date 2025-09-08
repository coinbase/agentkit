import { ZerionFungiblePosition, ZerionPortfolio } from "./types";

export const formatPortfolioData = (data: ZerionPortfolio) => {
  // Total value
  const totalValue = data.attributes.total.positions;
  const totalValueStr = `$${totalValue.toFixed(2)}`;

  // 24h change
  const changePercent = data.attributes.changes.percent_1d;
  const changeStr = `${changePercent.toFixed(2)}%`;

  // Positions by type (filter out 0)
  const types = Object.entries(data.attributes.positions_distribution_by_type)
    .filter(([_, v]) => v > 0)
    .map(([type, value]) => `${type}: $${value.toFixed(2)}`)
    .join(", ");

  // Positions by chain (top 5 by value)
  const topChains = Object.entries(data.attributes.positions_distribution_by_chain)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([chain, value]) => `${chain}: $${value.toFixed(2)}`)
    .join(", ");

  // Final summary string
  return `Wallet Portfolio Overview:
- Total Value: ${totalValueStr}
- 24h Change: ${changeStr}
- Position Types: ${types}
- Top Chains: ${topChains}`;
};

export const formatPositionsData = (data: ZerionFungiblePosition[]) => {
  const filtered = data.filter(pos => pos.attributes.value !== null);

  // Sort by value (descending)
  const sorted = filtered.sort((a, b) => b.attributes.value! - a.attributes.value!);

  const lines: string[] = [];
  let totalValue = 0;

  for (const pos of sorted) {
    const { value, position_type, fungible_info, application_metadata } = pos.attributes;

    const chain = pos.relationships.chain.data.id;

    const protocolLine = application_metadata?.name ? `via ${application_metadata.name}` : "";

    lines.push(
      `- ${fungible_info.symbol} (${
        fungible_info.name
      }) on ${chain} — $${value!.toFixed(2)} [${position_type}${
        protocolLine ? " " + protocolLine : ""
      }]`,
    );

    totalValue += value!;
  }

  return `Total Value: $${totalValue.toFixed(2)}\n\nToken Positions (>$1):\n${lines.join("\n")}`;
};
