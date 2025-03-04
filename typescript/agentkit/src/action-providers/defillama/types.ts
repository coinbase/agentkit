/**
 * Interface representing a DeFi protocol from DefiLlama
 */
export interface Protocol {
  name: string;
  address?: string;
  symbol?: string;
  url?: string;
  description?: string;
  chain?: string;
  logo?: string;
  audits?: string;
  category?: string;
  tvl?: number;
}
