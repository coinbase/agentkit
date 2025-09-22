export type SuperfluidAccountResponse = {
  accounts: Account[];
};

type Account = {
  isSuperApp: boolean;
  inflows: Flow[]; // Assuming inflows have the same structure as outflows, adjust if needed
  outflows: Flow[];
  accountTokenSnapshots: AccountTokenSnapshot[];
};

type Flow = {
  currentFlowRate: string;
  token: Token;
  receiver: Receiver;
};

type Token = {
  symbol?: string; // Optional because "symbol" is only seen in outflows
  id?: string; // Optional because "id" is only seen in accountTokenSnapshots
};

type Receiver = {
  id: string;
};

type AccountTokenSnapshot = {
  token: Token;
  totalNumberOfActiveStreams: number;
  totalNetFlowRate: string;
};
