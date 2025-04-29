/**
 * Props used to get an Onramp buy URL by directly providing a CDP project ID.
 * See https://docs.cdp.coinbase.com/onramp/docs/api-initializing#generating-the-coinbase-onramp-buysell-url
 *
 * Note: exported as public Type
 */
export type GetOnrampUrlWithProjectIdParams = {
  /**
   * The Project ID of your CDP project created at https://portal.cdp.coinbase.com/
   * This must be provided if you don't provide a sessionToken.
   */
  projectId: string;
  sessionToken?: never;
  /**
   * The addresses that the customer's funds should be delivered to.
   *
   * Each entry in the record represents a wallet address and the networks it is valid for. There should only be a
   * single address for each network your app supports. Users will be able to buy/send any asset supported by any of
   * the networks you specify. See the assets param if you want to restrict the available assets.
   *
   * Some common examples:
   *
   * Support all assets that are available for sending on the base network, only on the base network:
   *
   * `{ "0x1": ["base"] }`
   */
  addresses: Record<string, string[]>;
  /**
   * This optional parameter will restrict the assets available for the user to buy/send. It acts as a filter on the
   * networks specified in the {addresses} param.
   *
   * Some common examples:
   *
   * Support only USDC on either the base network or the ethereum network:
   *
   * `addresses: { "0x1": ["base", "ethereum"] }, assets: ["USDC"]`
   *
   * The values in this list can either be asset symbols like BTC, ETH, or asset UUIDs that you can get from the Buy
   * Options API {@link https://docs.cdp.coinbase.com/onramp/docs/api-configurations/#buy-options}.
   */
  assets?: string[];
} & GetOnrampBuyUrlOptionalProps;

/**
 * Props used to get an Onramp buy URL using a session token created using the Onramp session token API.
 * See https://docs.cdp.coinbase.com/onramp/docs/api-initializing#getting-an-coinbase-onramp-buysell-session-token
 *
 * Note: exported as public Type
 */
export type GetOnrampUrlWithSessionTokenParams = {
  /**
   * A session token create using the Onramp session token API. The token will be linked to the project ID, addresses,
   * and assets params provided in the create session token API request.
   */
  sessionToken: string;
  projectId?: never;
  addresses?: never;
  assets?: never;
} & GetOnrampBuyUrlOptionalProps;

/**
 * The optional properties that can be used to create an Onramp buy URL.
 */
type GetOnrampBuyUrlOptionalProps = {
  /**
   * If specified, this asset will be automatically selected for the user in the Onramp UI. Should be a valid asset
   * symbol e.g. BTC, ETH, USDC.
   */
  defaultAsset?: string;
  /**
   * If specified, this network will be automatically selected for the user in the Onramp UI. Should be a valid network
   * name in lower case e.g. ethereum, base.
   */
  defaultNetwork?: string;
  /**
   * A unique identifier that will be associated with any transactions created by the user during their Onramp session.
   * You can use this with the Transaction Status API to check the status of the user's transaction.
   * See https://docs.cdp.coinbase.com/onramp/docs/api-reporting#buy-transaction-status
   */
  partnerUserId?: string;
  /**
   * This amount will be used to pre-fill the amount of crypto the user is buying or sending. The user can choose to
   * change this amount in the UI. Only one of presetCryptoAmount or presetFiatAmount should be provided.
   */
  presetCryptoAmount?: number;
  /**
   * This amount will be used to pre-fill the fiat value of the crypto the user is buying or sending. The user can
   * choose to change this amount in the UI. Only one of presetCryptoAmount or presetFiatAmount should be provided.
   */
  presetFiatAmount?: number;

  /**
   * The default payment method that will be selected for the user in the Onramp UI. Should be one of the payment methods
   */
  defaultPaymentMethod?: string;
  /**
   * The currency code of the fiat amount provided in the presetFiatAmount param e.g. USD, CAD, EUR.
   */
  fiatCurrency?: string;
  /**
   * A URL that the user will be automatically redirected to after a successful buy/send. The domain must match a domain
   * on the domain allowlist in Coinbase Developer Platform (https://portal.cdp.coinbase.com/products/onramp).
   */
  redirectUrl?: string;

  /**
   * The name of the component that is calling the Onramp buy URL. This will be used for analytics.
   */
  originComponentName?: string;
};
