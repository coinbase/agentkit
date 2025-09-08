// Zerion API response types
export interface ZerionFungiblePositionsResponse {
  links: {
    self: string;
  };
  data: ZerionFungiblePosition[];
}

export interface ZerionPortfolioResponse {
  links: {
    self: string;
  };
  data: ZerionPortfolio;
}

export interface ZerionPortfolio {
  type: string;
  id: string;
  attributes: PortfolioAttributes;
}

export interface PortfolioAttributes {
  positions_distribution_by_type: {
    wallet: number;
    deposited: number;
    borrowed: number;
    locked: number;
    staked: number;
  };
  positions_distribution_by_chain: {
    [key: string]: number;
  };
  total: {
    positions: number;
  };
  changes: {
    absolute_1d: number;
    percent_1d: number;
  };
}

export interface ZerionFungiblePosition {
  type: string;
  id: string;
  attributes: FungibleAttributes;
  relationships: Relationships;
}

export interface FungibleAttributes {
  parent: null | string;
  protocol: null | string;
  pool_address?: string;
  group_id?: string;
  name: string;
  position_type: PositionType;
  quantity: Quantity;
  value: number | null;
  price: number;
  changes: Changes | null;
  fungible_info: FungibleInfo;
  flags: AttributesFlags;
  updated_at: Date;
  updated_at_block: number | null;
  application_metadata?: ApplicationMetadata;
}

export interface ApplicationMetadata {
  name: string;
  icon: Icon;
  url: string;
}

export interface Icon {
  url: string;
}

export interface Changes {
  absolute_1d: number;
  percent_1d: number;
}

export interface AttributesFlags {
  displayable: boolean;
  is_trash: boolean;
}

export interface FungibleInfo {
  name: string;
  symbol: string;
  icon: Icon | null;
  flags: FungibleInfoFlags;
  implementations: Implementation[];
}

export interface FungibleInfoFlags {
  verified: boolean;
}

export interface Implementation {
  chain_id: string;
  address: null | string;
  decimals: number;
}

export enum PositionType {
  Deposit = "deposit",
  Reward = "reward",
  Staked = "staked",
  Wallet = "wallet",
}

export interface Quantity {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
}

export interface Relationships {
  chain: Chain;
  dapp?: Dapp;
  fungible: Chain;
}

export interface Dapp {
  data: Data;
}

export interface Chain {
  links: {
    related: string;
  };
  data: Data;
}

export interface Data {
  type: DataType;
  id: string;
}

export enum DataType {
  Chains = "chains",
  Dapps = "dapps",
  Fungibles = "fungibles",
}
