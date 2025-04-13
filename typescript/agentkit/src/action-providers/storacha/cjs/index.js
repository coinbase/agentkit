"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var src_exports = {};
__export(src_exports, {
  Account: () => account_exports,
  Client: () => Client,
  Result: () => result_exports,
  asAbilities: () => asAbilities,
  authorizeContentServe: () => authorizeContentServe,
  create: () => create
});
module.exports = __toCommonJS(src_exports);
var import_agent3 = require("@web3-storage/access/agent");
var import_store_indexeddb = require("@web3-storage/access/stores/store-indexeddb");
var import_rsa = require("@ucanto/principal/rsa");

// src/client.js
var import_upload_client6 = require("@web3-storage/upload-client");
var import_capabilities9 = require("@web3-storage/capabilities");
var DIDMailto2 = __toESM(require("@web3-storage/did-mailto"), 1);

// src/base.js
var import_agent = require("@web3-storage/access/agent");

// src/service.js
var client = __toESM(require("@ucanto/client"), 1);
var import_transport = require("@ucanto/transport");
var DID = __toESM(require("@ipld/dag-ucan/did"), 1);
var import_upload_client = require("@web3-storage/upload-client");
var accessServiceURL = new URL("https://up.web3.storage");
var accessServicePrincipal = DID.parse("did:web:web3.storage");
var accessServiceConnection = client.connect({
  id: accessServicePrincipal,
  codec: import_transport.CAR.outbound,
  channel: import_transport.HTTP.open({
    url: accessServiceURL,
    method: "POST"
  })
});
var uploadServiceURL = new URL("https://up.web3.storage");
var uploadServicePrincipal = DID.parse("did:web:web3.storage");
var uploadServiceConnection = client.connect({
  id: uploadServicePrincipal,
  codec: import_transport.CAR.outbound,
  channel: import_transport.HTTP.open({
    url: uploadServiceURL,
    method: "POST"
  })
});
var filecoinServiceURL = new URL("https://up.web3.storage");
var filecoinServicePrincipal = DID.parse("did:web:web3.storage");
var filecoinServiceConnection = client.connect({
  id: filecoinServicePrincipal,
  codec: import_transport.CAR.outbound,
  channel: import_transport.HTTP.open({
    url: filecoinServiceURL,
    method: "POST"
  })
});
var serviceConf = {
  access: accessServiceConnection,
  upload: uploadServiceConnection,
  filecoin: filecoinServiceConnection
};

// src/base.js
var Base = class {
  /**
   * @type {Agent}
   * @protected
   */
  _agent;
  /**
   * @type {import('./types.js').ServiceConf}
   * @protected
   */
  _serviceConf;
  /**
   * @param {import('@web3-storage/access').AgentData} agentData
   * @param {object} [options]
   * @param {import('./types.js').ServiceConf} [options.serviceConf]
   * @param {URL} [options.receiptsEndpoint]
   */
  constructor(agentData, options = {}) {
    this._serviceConf = options.serviceConf ?? serviceConf;
    this._agent = new import_agent.Agent(agentData, {
      servicePrincipal: this._serviceConf.access.id,
      // @ts-expect-error I know but it will be HTTP for the forseeable.
      url: this._serviceConf.access.channel.url,
      connection: this._serviceConf.access
    });
    this._receiptsEndpoint = options.receiptsEndpoint ?? import_upload_client.receiptsEndpoint;
  }
  /**
   * The current user agent (this device).
   *
   * @type {Agent}
   */
  get agent() {
    return this._agent;
  }
  /**
   * @protected
   * @param {import('./types.js').Ability[]} abilities
   */
  async _invocationConfig(abilities) {
    const resource = this._agent.currentSpace();
    if (!resource) {
      throw new Error(
        "missing current space: use createSpace() or setCurrentSpace()"
      );
    }
    const issuer = this._agent.issuer;
    const proofs = await this._agent.proofs(
      abilities.map((can) => ({ can, with: resource }))
    );
    const audience = this._serviceConf.upload.id;
    return { issuer, with: resource, proofs, audience };
  }
};

// src/account.js
var account_exports = {};
__export(account_exports, {
  Account: () => Account,
  AccountPlan: () => AccountPlan,
  externalLogin: () => externalLogin,
  fromEmail: () => import_did_mailto.fromEmail,
  list: () => list2,
  login: () => login
});

// src/capability/access.js
var Agent2 = __toESM(require("@web3-storage/access/agent"), 1);
var DIDMailto = __toESM(require("@web3-storage/did-mailto"), 1);

// src/result.js
var result_exports = {};
__export(result_exports, {
  try: () => unwrap,
  unwrap: () => unwrap
});
__reExport(result_exports, require("@ucanto/core/result"));
var API = __toESM(require("@ucanto/interface"), 1);
var unwrap = ({ ok: ok2, error: error2 }) => {
  if (error2) {
    throw error2;
  } else {
    return (
      /** @type {T} */
      ok2
    );
  }
};

// src/capability/access.js
var AccessClient = class extends Base {
  /* c8 ignore start - testing websocket code is hard */
  /**
   * Authorize the current agent to use capabilities granted to the passed
   * email account.
   *
   * @deprecated Use `request` instead.
   *
   * @param {`${string}@${string}`} email
   * @param {object} [options]
   * @param {AbortSignal} [options.signal]
   * @param {Iterable<{ can: API.Ability }>} [options.capabilities]
   */
  async authorize(email2, options) {
    const account = DIDMailto.fromEmail(email2);
    const authorization = unwrap(await request(this, { account }));
    const access = unwrap(await authorization.claim(options));
    await unwrap(await access.save());
    return access.proofs;
  }
  /* c8 ignore stop */
  /**
   * Claim delegations granted to the account associated with this agent.
   *
   * @param {object} [input]
   * @param {API.DID} [input.audience]
   */
  async claim(input) {
    const access = unwrap(await claim(this, input));
    await unwrap(await access.save());
    return access.proofs;
  }
  /**
   * Requests specified `access` level from the account from the given account.
   *
   * @param {object} input
   * @param {API.AccountDID} input.account
   * @param {API.Access} [input.access]
   * @param {AbortSignal} [input.signal]
   */
  async request(input) {
    return await request(this, input);
  }
  /**
   * Shares access with delegates.
   *
   * @param {object} input
   * @param {API.Delegation[]} input.delegations
   * @param {API.SpaceDID} [input.space]
   * @param {API.Delegation[]} [input.proofs]
   */
  async delegate(input) {
    return await delegate(this, input);
  }
};
var claim = async ({ agent }, input) => Agent2.Access.claim(agent, input);
var request = async ({ agent }, input) => Agent2.Access.request(agent, input);
var createPendingAccessRequest = ({ agent }, input) => Agent2.Access.createPendingAccessRequest(agent, input);
var delegate = async ({ agent }, input) => Agent2.Access.delegate(agent, input);
var { spaceAccess, accountAccess } = Agent2.Access;

// src/capability/plan.js
var Plan = __toESM(require("@web3-storage/capabilities/plan"), 1);
var PlanClient = class extends Base {
  /**
   * Required delegated capabilities:
   * - `plan/get`
   *
   * @param {import('@web3-storage/access').AccountDID} account
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async get(account, options) {
    const out = await get2({ agent: this.agent }, { ...options, account });
    if (!out.ok) {
      throw new Error(`failed ${Plan.get.can} invocation`, {
        cause: out.error
      });
    }
    return out.ok;
  }
  /**
   * Required delegated capabilities:
   * - `plan/set`
   *
   * @param {API.AccountDID} account
   * @param {API.DID} product
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async set(account, product, options) {
    const out = await set2(
      { agent: this.agent },
      { ...options, account, product }
    );
    if (!out.ok) {
      throw new Error(`failed ${Plan.set.can} invocation`, {
        cause: out.error
      });
    }
    return out.ok;
  }
  /**
   *
   * @param {API.AccountDID} account
   * @param {string} returnURL
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async createAdminSession(account, returnURL, options) {
    const out = await createAdminSession2(
      { agent: this.agent },
      { ...options, account, returnURL }
    );
    if (!out.ok) {
      throw new Error(`failed ${Plan.createAdminSession.can} invocation`, {
        cause: out.error
      });
    }
    return out.ok;
  }
};
var get2 = async ({ agent }, { account, nonce, proofs = [] }) => {
  const receipt = await agent.invokeAndExecute(Plan.get, {
    with: account,
    proofs,
    nonce
  });
  return receipt.out;
};
var set2 = async ({ agent }, { account, product, nonce, proofs = [] }) => {
  const receipt = await agent.invokeAndExecute(Plan.set, {
    with: account,
    nb: { product },
    nonce,
    proofs
  });
  return receipt.out;
};
var createAdminSession2 = async ({ agent }, { account, returnURL, nonce, proofs = [] }) => {
  const receipt = await agent.invokeAndExecute(Plan.createAdminSession, {
    with: account,
    proofs,
    nonce,
    nb: {
      returnURL
    }
  });
  return receipt.out;
};

// src/capability/subscription.js
var import_capabilities = require("@web3-storage/capabilities");
var SubscriptionClient = class extends Base {
  /**
   * List subscriptions for the passed account.
   *
   * Required delegated capabilities:
   * - `subscription/list`
   *
   * @param {import('@web3-storage/access').AccountDID} account
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  /* c8 ignore next */
  async list(account, options) {
    const out = await list({ agent: this.agent }, { ...options, account });
    if (!out.ok) {
      throw new Error(
        `failed ${import_capabilities.Subscription.list.can} invocation`,
        {
          cause: out.error
        }
      );
    }
    return out.ok;
  }
};
var list = async ({ agent }, { account, nonce, proofs = [] }) => {
  const receipt = await agent.invokeAndExecute(import_capabilities.Subscription.list, {
    with: account,
    proofs,
    nb: {},
    nonce
  });
  return receipt.out;
};

// src/account.js
var import_agent2 = require("@web3-storage/access/agent");
var import_provider = require("@web3-storage/access/provider");
var import_did_mailto = require("@web3-storage/did-mailto");
var UCAN = __toESM(require("@web3-storage/capabilities/ucan"), 1);
var list2 = ({ agent }, { account } = {}) => {
  const query = (
    /** @type {API.CapabilityQuery} */
    {
      with: account ?? /did:mailto:.*/,
      can: "*"
    }
  );
  const proofs = agent.proofs([query]);
  const accounts = {};
  const attestations = {};
  for (const proof of proofs) {
    const access = import_agent2.Delegation.allows(proof);
    for (const [resource, abilities] of Object.entries(access)) {
      if (import_provider.AccountDID.is(resource) && abilities["*"]) {
        const id = (
          /** @type {API.DidMailto} */
          resource
        );
        const account2 = accounts[id] || (accounts[id] = new Account({ id, agent, proofs: [] }));
        account2.addProof(proof);
      }
      for (
        const settings of
        /** @type {{proof?:API.Link}[]} */
        abilities["ucan/attest"] || []
      ) {
        const id = settings.proof;
        if (id) {
          attestations[`${id}`] = proof;
        }
      }
    }
  }
  for (const account2 of Object.values(accounts)) {
    for (const proof of account2.proofs) {
      const attestation = attestations[`${proof.cid}`];
      if (attestation) {
        account2.addProof(attestation);
      }
    }
  }
  return accounts;
};
var login = async ({ agent }, email2, options = {}) => {
  const account = (0, import_did_mailto.fromEmail)(email2);
  const session = list2({ agent }, { account })[account];
  if (session) {
    return { ok: session };
  }
  const result = await request(
    { agent },
    {
      account,
      access: accountAccess
    }
  );
  const { ok: access, error: error2 } = result;
  if (error2) {
    return { error: error2 };
  } else {
    const { ok: ok2, error: error3 } = await access.claim({ signal: options.signal });
    if (error3) {
      return { error: error3 };
    } else {
      return { ok: new Account({ id: account, proofs: ok2.proofs, agent }) };
    }
  }
};
var externalLogin = async ({ agent }, { request: request2, expiration, ...options }) => {
  const access = createPendingAccessRequest(
    { agent },
    { request: request2, expiration }
  );
  const { ok: ok2, error: error2 } = await access.claim({ signal: options.signal });
  if (error2) {
    return { error: error2 };
  }
  let attestedProof;
  for (const p of ok2.proofs) {
    if (isUCANAttest(p)) {
      attestedProof = p.capabilities[0].nb.proof;
      break;
    }
  }
  if (!attestedProof) {
    return { error: new Error("missing attestation") };
  }
  let account;
  for (const p of ok2.proofs) {
    if (p.cid.toString() === attestedProof.toString()) {
      try {
        account = DIDMailto.fromString(p.issuer.did());
      } catch (err) {
        return { error: new Error("invalid account DID", { cause: err }) };
      }
      break;
    }
  }
  if (!account) {
    return { error: new Error("missing attested delegation") };
  }
  return { ok: new Account({ id: account, proofs: ok2.proofs, agent }) };
};
var isUCANAttest = (d) => d.capabilities[0].can === UCAN.attest.can;
var Account = class {
  /**
   * @param {Model} model
   */
  constructor(model) {
    this.model = model;
    this.plan = new AccountPlan(model);
  }
  get agent() {
    return this.model.agent;
  }
  get proofs() {
    return this.model.proofs;
  }
  did() {
    return this.model.id;
  }
  toEmail() {
    return (0, import_did_mailto.toEmail)(this.did());
  }
  /**
   * @param {API.Delegation} proof
   */
  addProof(proof) {
    this.proofs.push(proof);
  }
  toJSON() {
    return {
      id: this.did(),
      proofs: this.proofs.sort((a, b) => a.cid.toString().localeCompare(b.cid.toString())).map((proof) => proof.toJSON())
    };
  }
  /**
   * Provisions given `space` with this account.
   *
   * @param {API.SpaceDID} space
   * @param {object} input
   * @param {API.ProviderDID} [input.provider]
   * @param {API.Agent} [input.agent]
   */
  provision(space, input = {}) {
    return (0, import_provider.add)(this.agent, {
      ...input,
      account: this.did(),
      consumer: space,
      proofs: this.proofs
    });
  }
  /**
   * Saves account in the agent store so it can be accessed across sessions.
   *
   * @param {object} input
   * @param {API.Agent} [input.agent]
   */
  async save({ agent = this.agent } = {}) {
    return await (0, import_agent2.importAuthorization)(agent, this);
  }
};
var AccountPlan = class {
  /**
   * @param {Model} model
   */
  constructor(model) {
    this.model = model;
  }
  /**
   * Gets information about the plan associated with this account.
   *
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async get(options) {
    return await get2(this.model, {
      ...options,
      account: this.model.id,
      proofs: this.model.proofs
    });
  }
  /**
   * Sets the plan associated with this account.
   *
   * @param {import('@ucanto/interface').DID} productDID
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async set(productDID, options) {
    return await set2(this.model, {
      ...options,
      account: this.model.id,
      product: productDID,
      proofs: this.model.proofs
    });
  }
  /**
   * Waits for a payment plan to be selected.
   * This method continuously checks the account's payment plan status
   * at a specified interval until a valid plan is selected, or when the timeout is reached,
   * or when the abort signal is aborted.
   *
   * @param {object} [options]
   * @param {number} [options.interval] - The polling interval in milliseconds (default is 1000ms).
   * @param {number} [options.timeout] - The maximum time to wait in milliseconds before throwing a timeout error (default is 15 minutes).
   * @param {AbortSignal} [options.signal] - An optional AbortSignal to cancel the waiting process.
   * @returns {Promise<import('@web3-storage/access').PlanGetSuccess>} - Resolves once a payment plan is selected within the timeout.
   * @throws {Error} - Throws an error if there is an issue retrieving the payment plan or if the timeout is exceeded.
   */
  async wait(options) {
    const startTime = Date.now();
    const interval = options?.interval || 1e3;
    const timeout = options?.timeout || 60 * 15 * 1e3;
    while (true) {
      const res = await this.get();
      if (res.ok) return res.ok;
      if (res.error) {
        throw new Error(`Error retrieving payment plan: ${res.error}`);
      }
      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout: Payment plan selection took too long.");
      }
      if (options?.signal?.aborted) {
        throw new Error("Aborted: Payment plan selection was aborted.");
      }
      console.log("Waiting for payment plan to be selected...");
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  /**
   *
   * @param {import('@web3-storage/access').AccountDID} accountDID
   * @param {string} returnURL
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async createAdminSession(accountDID, returnURL, options) {
    return await createAdminSession2(this.model, {
      ...options,
      account: accountDID,
      returnURL
    });
  }
  /**
   *
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async subscriptions(options) {
    return await list(this.model, {
      ...options,
      account: this.model.id,
      proofs: this.model.proofs
    });
  }
};

// src/space.js
var space_exports = {};
__export(space_exports, {
  Space: () => Space,
  StorageUsage: () => StorageUsage
});
__reExport(space_exports, require("@web3-storage/access/space"));

// src/capability/usage.js
var import_capabilities2 = require("@web3-storage/capabilities");
var UsageClient = class extends Base {
  /**
   * Get a usage report for the passed space in the given time period.
   *
   * Required delegated capabilities:
   * - `usage/report`
   *
   * @param {import('../types.js').SpaceDID} space
   * @param {{ from: Date, to: Date }} period
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async report(space, period, options) {
    const out = await report(
      { agent: this.agent },
      { ...options, space, period }
    );
    if (!out.ok) {
      throw new Error(`failed ${import_capabilities2.Usage.report.can} invocation`, {
        cause: out.error
      });
    }
    return out.ok;
  }
};
var report = async ({ agent }, { space, period, nonce, proofs = [] }) => {
  const receipt = await agent.invokeAndExecute(import_capabilities2.Usage.report, {
    with: space,
    proofs,
    nonce,
    nb: {
      period: {
        from: Math.floor(period.from.getTime() / 1e3),
        to: Math.ceil(period.to.getTime() / 1e3)
      }
    }
  });
  return receipt.out;
};

// src/space.js
var Space = class {
  #model;
  /**
   * @param {Model} model
   */
  constructor(model) {
    this.#model = model;
    this.usage = new StorageUsage(model);
  }
  /**
   * The given space name.
   */
  get name() {
    return String(this.#model.meta?.name ?? "");
  }
  /**
   * The DID of the space.
   */
  did() {
    return this.#model.id;
  }
  /**
   * User defined space metadata.
   */
  meta() {
    return this.#model.meta;
  }
};
var StorageUsage = class {
  #model;
  /**
   * @param {Model} model
   */
  constructor(model) {
    this.#model = model;
  }
  /**
   * Get the current usage in bytes.
   */
  async get() {
    const { agent } = this.#model;
    const space = this.#model.id;
    const now = /* @__PURE__ */ new Date();
    const period = {
      // we may not have done a snapshot for this month _yet_, so get report
      // from last month -> now
      from: startOfLastMonth(now),
      to: now
    };
    const result = await report({ agent }, { space, period });
    if (result.error) return result;
    const provider = (
      /** @type {API.ProviderDID} */
      agent.connection.id.did()
    );
    const report2 = result.ok[provider];
    return {
      /* c8 ignore next */
      ok: report2?.size.final == null ? void 0 : BigInt(report2.size.final)
    };
  }
};
var startOfMonth = (now) => {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0);
  d.setUTCMinutes(0);
  d.setUTCSeconds(0);
  d.setUTCMilliseconds(0);
  return d;
};
var startOfLastMonth = (now) => {
  const d = startOfMonth(now);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d;
};

// src/delegation.js
var delegation_exports = {};
__export(delegation_exports, {
  AgentDelegation: () => AgentDelegation
});
var import_delegation = require("@ucanto/core/delegation");
__reExport(delegation_exports, require("@ucanto/core/delegation"));
var AgentDelegation = class extends import_delegation.Delegation {
  /* c8 ignore stop */
  /** @type {Record<string, any>} */
  #meta;
  /**
   * @param {import('./types.js').UCANBlock<C>} root
   * @param {Map<string, import('./types.js').Block>} [blocks]
   * @param {Record<string, any>} [meta]
   */
  constructor(root, blocks, meta = {}) {
    super(root, blocks);
    this.#meta = meta;
  }
  /**
   * User defined delegation metadata.
   */
  meta() {
    return this.#meta;
  }
};

// src/capability/blob.js
var import_upload_client2 = require("@web3-storage/upload-client");
var import_capabilities3 = require("@web3-storage/capabilities");
var import_sha2 = require("multiformats/hashes/sha2");
var BlobClient = class extends Base {
  /**
   * Store a Blob to the resource.
   *
   * Required delegated capabilities:
   * - `space/blob/add`
   *
   * @param {Blob} blob - blob data.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async add(blob, options = {}) {
    options = {
      receiptsEndpoint: this._receiptsEndpoint.toString(),
      connection: this._serviceConf.upload,
      ...options
    };
    const conf = await this._invocationConfig([import_capabilities3.Blob.add.can]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const digest = await import_sha2.sha256.digest(bytes);
    return { digest, ...await import_upload_client2.Blob.add(conf, digest, bytes, options) };
  }
  /**
   * List blobs stored to the resource.
   *
   * Required delegated capabilities:
   * - `space/blob/list`
   *
   * @param {import('../types.js').ListRequestOptions} [options]
   */
  async list(options = {}) {
    const conf = await this._invocationConfig([import_capabilities3.Blob.list.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client2.Blob.list(conf, options);
  }
  /**
   * Remove a stored blob by multihash digest.
   *
   * Required delegated capabilities:
   * - `space/blob/remove`
   *
   * @param {import('multiformats').MultihashDigest} digest - digest of blob to remove.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async remove(digest, options = {}) {
    const conf = await this._invocationConfig([import_capabilities3.Blob.remove.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client2.Blob.remove(conf, digest, options);
  }
  /**
   * Gets a stored blob by multihash digest.
   *
   * @param {import('multiformats').MultihashDigest} digest - digest of blob to get.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async get(digest, options = {}) {
    const conf = await this._invocationConfig([import_capabilities3.Blob.get.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client2.Blob.get(conf, digest, options);
  }
};

// src/capability/index.js
var import_upload_client3 = require("@web3-storage/upload-client");
var import_capabilities4 = require("@web3-storage/capabilities");
var IndexClient = class extends Base {
  /**
   * Register an "index" to the resource.
   *
   * Required delegated capabilities:
   * - `space/index/add`
   *
   * @param {import('../types.js').CARLink} index - CID of the CAR file that contains the index data.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async add(index, options = {}) {
    const conf = await this._invocationConfig([import_capabilities4.Index.add.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client3.Index.add(conf, index, options);
  }
};

// src/capability/store.js
var import_upload_client4 = require("@web3-storage/upload-client");
var import_capabilities5 = require("@web3-storage/capabilities");
var StoreClient = class extends Base {
  /**
   * Store a DAG encoded as a CAR file.
   *
   * Required delegated capabilities:
   * - `store/add`
   *
   * @deprecated Use `client.capability.blob.add()` instead.
   * @param {Blob} car - CAR file data.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async add(car, options = {}) {
    const conf = await this._invocationConfig([import_capabilities5.Store.add.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client4.Store.add(conf, car, options);
  }
  /**
   * Get details of a stored item.
   *
   * Required delegated capabilities:
   * - `store/get`
   *
   * @deprecated Use `client.capability.blob.get()` instead.
   * @param {import('../types.js').CARLink} link - Root data CID for the DAG that was stored.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async get(link, options = {}) {
    const conf = await this._invocationConfig([import_capabilities5.Store.get.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client4.Store.get(conf, link, options);
  }
  /**
   * List CAR files stored to the resource.
   *
   * Required delegated capabilities:
   * - `store/list`
   *
   * @deprecated Use `client.capability.blob.list()` instead.
   * @param {import('../types.js').ListRequestOptions} [options]
   */
  async list(options = {}) {
    const conf = await this._invocationConfig([import_capabilities5.Store.list.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client4.Store.list(conf, options);
  }
  /**
   * Remove a stored CAR file by CAR CID.
   *
   * Required delegated capabilities:
   * - `store/remove`
   *
   * @deprecated Use `client.capability.blob.remove()` instead.
   * @param {import('../types.js').CARLink} link - CID of CAR file to remove.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async remove(link, options = {}) {
    const conf = await this._invocationConfig([import_capabilities5.Store.remove.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client4.Store.remove(conf, link, options);
  }
};

// src/capability/upload.js
var import_upload_client5 = require("@web3-storage/upload-client");
var import_capabilities6 = require("@web3-storage/capabilities");
var UploadClient = class extends Base {
  /**
   * Register an "upload" to the resource.
   *
   * Required delegated capabilities:
   * - `upload/add`
   *
   * @param {import('../types.js').UnknownLink} root - Root data CID for the DAG that was stored.
   * @param {import('../types.js').CARLink[]} shards - CIDs of CAR files that contain the DAG.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async add(root, shards, options = {}) {
    const conf = await this._invocationConfig([import_capabilities6.Upload.add.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client5.Upload.add(conf, root, shards, options);
  }
  /**
   * Get details of an "upload".
   *
   * Required delegated capabilities:
   * - `upload/get`
   *
   * @param {import('../types.js').UnknownLink} root - Root data CID for the DAG that was stored.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async get(root, options = {}) {
    const conf = await this._invocationConfig([import_capabilities6.Upload.get.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client5.Upload.get(conf, root, options);
  }
  /**
   * List uploads registered to the resource.
   *
   * Required delegated capabilities:
   * - `upload/list`
   *
   * @param {import('../types.js').ListRequestOptions} [options]
   */
  async list(options = {}) {
    const conf = await this._invocationConfig([import_capabilities6.Upload.list.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client5.Upload.list(conf, options);
  }
  /**
   * Remove an upload by root data CID.
   *
   * Required delegated capabilities:
   * - `upload/remove`
   *
   * @param {import('../types.js').UnknownLink} root - Root data CID to remove.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async remove(root, options = {}) {
    const conf = await this._invocationConfig([import_capabilities6.Upload.remove.can]);
    options.connection = this._serviceConf.upload;
    return import_upload_client5.Upload.remove(conf, root, options);
  }
};

// src/capability/space.js
var import_capabilities7 = require("@web3-storage/capabilities");
var SpaceClient = class extends Base {
  /**
   * Get information about a space.
   *
   * Required delegated capabilities:
   * - `space/info`
   *
   * @param {import('../types.js').DID} space - DID of the space to retrieve info about.
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async info(space, options) {
    return await this._agent.getSpaceInfo(space, options);
  }
  /**
   * Record egress data for a served resource.
   * It will execute the capability invocation to find the customer and then record the egress data for the resource.
   *
   * Required delegated capabilities:
   * - `space/content/serve/egress/record`
   *
   * @param {object} egressData
   * @param {import('../types.js').SpaceDID} egressData.space
   * @param {API.UnknownLink} egressData.resource
   * @param {number} egressData.bytes
   * @param {string} egressData.servedAt
   * @param {object} [options]
   * @param {string} [options.nonce]
   * @param {API.Delegation[]} [options.proofs]
   * @returns {Promise<API.EgressRecordSuccess>}
   */
  async egressRecord(egressData, options) {
    const out = await egressRecord(
      { agent: this.agent },
      { ...egressData },
      { ...options }
    );
    if (!out.ok) {
      throw new Error(
        `failed ${import_capabilities7.Space.egressRecord.can} invocation`,
        {
          cause: out.error
        }
      );
    }
    return (
      /** @type {API.EgressRecordSuccess} */
      out.ok
    );
  }
};
var egressRecord = async ({ agent }, { space, resource, bytes, servedAt }, { nonce, proofs = [] }) => {
  const receipt = await agent.invokeAndExecute(import_capabilities7.Space.egressRecord, {
    with: space,
    proofs,
    nonce,
    nb: {
      resource,
      bytes,
      servedAt: Math.floor(new Date(servedAt).getTime() / 1e3)
    }
  });
  return receipt.out;
};

// src/capability/filecoin.js
var import_filecoin_client = require("@web3-storage/filecoin-client");
var import_capabilities8 = require("@web3-storage/capabilities");
var FilecoinClient = class extends Base {
  /**
   * Offer a Filecoin "piece" to the resource.
   *
   * Required delegated capabilities:
   * - `filecoin/offer`
   *
   * @param {import('multiformats').UnknownLink} content
   * @param {import('@web3-storage/capabilities/types').PieceLink} piece
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async offer(content, piece, options) {
    const conf = await this._invocationConfig([import_capabilities8.Filecoin.offer.can]);
    return import_filecoin_client.Storefront.filecoinOffer(conf, content, piece, {
      ...options,
      connection: this._serviceConf.filecoin
    });
  }
  /**
   * Request info about a content piece in Filecoin deals
   *
   * Required delegated capabilities:
   * - `filecoin/info`
   *
   * @param {import('@web3-storage/capabilities/types').PieceLink} piece
   * @param {object} [options]
   * @param {string} [options.nonce]
   */
  async info(piece, options) {
    const conf = await this._invocationConfig([import_capabilities8.Filecoin.info.can]);
    return import_filecoin_client.Storefront.filecoinInfo(conf, piece, {
      ...options,
      connection: this._serviceConf.filecoin
    });
  }
};

// src/coupon.js
var API2 = __toESM(require("@web3-storage/access/types"), 1);
var import_core = require("@ucanto/core");
var import_principal = require("@ucanto/principal");
var import_access = require("@web3-storage/access/access");
var CouponAPI = class extends Base {
  /**
   * Redeems coupon from the the the archive. Throws an error if the coupon
   * password is invalid or if provided archive is not a valid.
   *
   * @param {Uint8Array} archive
   * @param {object} [options]
   * @param {string} [options.password]
   */
  async redeem(archive2, options = {}) {
    const { agent } = this;
    const coupon = unwrap(await extract(archive2));
    return unwrap(await redeem(coupon, { ...options, agent }));
  }
  /**
   * Issues a coupon for the given delegation.
   *
   * @param {Omit<CouponOptions, 'issuer'>} options
   */
  async issue({ proofs = [], ...options }) {
    const { agent } = this;
    return await issue({
      ...options,
      issuer: agent.issuer,
      proofs: [...proofs, ...agent.proofs(options.capabilities)]
    });
  }
};
var extract = async (archive2) => {
  const { ok: ok2, error: error2 } = await import_core.Delegation.extract(archive2);
  return ok2 ? result_exports.ok(new Coupon({ proofs: [ok2] })) : result_exports.error(error2);
};
var archive = async (coupon) => {
  const [delegation] = coupon.proofs;
  return await import_core.Delegation.archive(delegation);
};
var issue = async ({ password = "", ...options }) => {
  const audience = await deriveSigner(password);
  const delegation = await (0, import_core.delegate)({
    ...options,
    audience
  });
  return new Coupon({ proofs: [delegation] });
};
var redeem = async (coupon, { agent, password = "" }) => {
  const audience = await deriveSigner(password);
  const [delegation] = coupon.proofs;
  if (delegation.audience.did() !== audience.did()) {
    return result_exports.error(
      new RangeError(
        password === "" ? "Extracting account requires a password" : "Provided password is invalid"
      )
    );
  } else {
    const authorization = await (0, import_core.delegate)({
      issuer: audience,
      audience: agent,
      capabilities: delegation.capabilities,
      expiration: delegation.expiration,
      notBefore: delegation.notBefore,
      proofs: [delegation]
    });
    return result_exports.ok(new import_access.GrantedAccess({ agent, proofs: [authorization] }));
  }
};
var deriveSigner = async (password) => {
  const { digest } = await import_core.sha256.digest(new TextEncoder().encode(password));
  return await import_principal.ed25519.Signer.derive(digest);
};
var Coupon = class {
  /**
   * @param {Model} model
   */
  constructor(model) {
    this.model = model;
  }
  get proofs() {
    return this.model.proofs;
  }
  /**
   *
   * @param {API.Agent} agent
   * @param {object} [options]
   * @param {string} [options.password]
   */
  redeem(agent, options = {}) {
    return redeem(this, { ...options, agent });
  }
  archive() {
    return archive(this);
  }
};

// src/client.js
var UcantoClient = __toESM(require("@ucanto/client"), 1);
var import_transport2 = require("@ucanto/transport");
var CAR2 = __toESM(require("@ucanto/transport/car"), 1);
var Client = class extends Base {
  /**
   * @param {import('@web3-storage/access').AgentData} agentData
   * @param {object} [options]
   * @param {import('./types.js').ServiceConf} [options.serviceConf]
   * @param {URL} [options.receiptsEndpoint]
   */
  constructor(agentData, options) {
    super(agentData, options);
    this.capability = {
      access: new AccessClient(agentData, options),
      filecoin: new FilecoinClient(agentData, options),
      index: new IndexClient(agentData, options),
      plan: new PlanClient(agentData, options),
      space: new SpaceClient(agentData, options),
      blob: new BlobClient(agentData, options),
      store: new StoreClient(agentData, options),
      subscription: new SubscriptionClient(agentData, options),
      upload: new UploadClient(agentData, options),
      usage: new UsageClient(agentData, options)
    };
    this.coupon = new CouponAPI(agentData, options);
  }
  did() {
    return this._agent.did();
  }
  /* c8 ignore start - testing websockets is hard */
  /**
   * @deprecated - Use client.login instead.
   *
   * Authorize the current agent to use capabilities granted to the passed
   * email account.
   *
   * @param {`${string}@${string}`} email
   * @param {object} [options]
   * @param {AbortSignal} [options.signal]
   * @param {Iterable<{ can: import('./types.js').Ability }>} [options.capabilities]
   */
  async authorize(email2, options) {
    await this.capability.access.authorize(email2, options);
  }
  /**
   * @param {Account.EmailAddress} email
   * @param {object} [options]
   * @param {AbortSignal} [options.signal]
   */
  async login(email2, options = {}) {
    const account = unwrap(await login(this, email2, options));
    unwrap(await account.save());
    return account;
  }
  /* c8 ignore stop */
  /**
   * List all accounts that agent has stored access to.
   *
   * @returns {Record<DIDMailto, Account>} A dictionary with `did:mailto` as keys and `Account` instances as values.
   */
  accounts() {
    return list2(this);
  }
  /**
   * Uploads a file to the service and returns the root data CID for the
   * generated DAG.
   *
   * Required delegated capabilities:
   * - `filecoin/offer`
   * - `space/blob/add`
   * - `space/index/add`
   * - `upload/add`
   *
   * @param {import('./types.js').BlobLike} file - File data.
   * @param {import('./types.js').UploadFileOptions} [options]
   */
  async uploadFile(file, options = {}) {
    const conf = await this._invocationConfig([
      import_capabilities9.Blob.add.can,
      import_capabilities9.Index.add.can,
      import_capabilities9.Filecoin.offer.can,
      import_capabilities9.Upload.add.can
    ]);
    options = {
      receiptsEndpoint: this._receiptsEndpoint.toString(),
      connection: this._serviceConf.upload,
      ...options
    };
    return (0, import_upload_client6.uploadFile)(conf, file, options);
  }
  /**
   * Uploads a directory of files to the service and returns the root data CID
   * for the generated DAG. All files are added to a container directory, with
   * paths in the file names preserved.
   *
   * Required delegated capabilities:
   * - `filecoin/offer`
   * - `space/blob/add`
   * - `space/index/add`
   * - `upload/add`
   *
   * @param {import('./types.js').FileLike[]} files - File data.
   * @param {import('./types.js').UploadDirectoryOptions} [options]
   */
  async uploadDirectory(files, options = {}) {
    const conf = await this._invocationConfig([
      import_capabilities9.Blob.add.can,
      import_capabilities9.Index.add.can,
      import_capabilities9.Filecoin.offer.can,
      import_capabilities9.Upload.add.can
    ]);
    options = {
      receiptsEndpoint: this._receiptsEndpoint.toString(),
      connection: this._serviceConf.upload,
      ...options
    };
    return (0, import_upload_client6.uploadDirectory)(conf, files, options);
  }
  /**
   * Uploads a CAR file to the service.
   *
   * The difference between this function and `capability.blob.add` is that
   * the CAR file is automatically sharded, an index is generated, uploaded and
   * registered (see `capability.index.add`) and finally an an "upload" is
   * registered, linking the individual shards (see `capability.upload.add`).
   *
   * Use the `onShardStored` callback to obtain the CIDs of the CAR file shards.
   *
   * Required delegated capabilities:
   * - `filecoin/offer`
   * - `space/blob/add`
   * - `space/index/add`
   * - `upload/add`
   *
   * @param {import('./types.js').BlobLike} car - CAR file.
   * @param {import('./types.js').UploadOptions} [options]
   */
  async uploadCAR(car, options = {}) {
    const conf = await this._invocationConfig([
      import_capabilities9.Blob.add.can,
      import_capabilities9.Index.add.can,
      import_capabilities9.Filecoin.offer.can,
      import_capabilities9.Upload.add.can
    ]);
    options = {
      receiptsEndpoint: this._receiptsEndpoint.toString(),
      connection: this._serviceConf.upload,
      ...options
    };
    return (0, import_upload_client6.uploadCAR)(conf, car, options);
  }
  /**
   * Get a receipt for an executed task by its CID.
   *
   * @param {import('multiformats').UnknownLink} taskCid
   */
  async getReceipt(taskCid) {
    const receiptsEndpoint2 = new URL(this._receiptsEndpoint).toString();
    return import_upload_client6.Receipt.poll(taskCid, { receiptsEndpoint: receiptsEndpoint2 });
  }
  /**
   * Return the default provider.
   */
  defaultProvider() {
    return this._agent.connection.id.did();
  }
  /**
   * The current space.
   */
  currentSpace() {
    const agent = this._agent;
    const id = agent.currentSpace();
    if (!id) return;
    const meta = agent.spaces.get(id);
    return new Space({ id, meta, agent });
  }
  /**
   * Use a specific space.
   *
   * @param {import('./types.js').DID} did
   */
  async setCurrentSpace(did) {
    await this._agent.setCurrentSpace(
      /** @type {`did:key:${string}`} */
      did
    );
  }
  /**
   * Spaces available to this agent.
   */
  spaces() {
    return [...this._agent.spaces].map(([id, meta]) => {
      return new Space({ id, meta, agent: this._agent });
    });
  }
  /**
   * Creates a new space with a given name.
   * If an account is not provided, the space is created without any delegation and is not saved, hence it is a temporary space.
   * When an account is provided in the options argument, then it creates a delegated recovery account
   * by provisioning the space, saving it and then delegating access to the recovery account.
   * In addition, it authorizes the listed Gateway Services to serve content from the created space.
   * It is done by delegating the `space/content/serve/*` capability to the Gateway Service.
   * User can skip the Gateway authorization by setting the `skipGatewayAuthorization` option to `true`.
   * If no gateways are specified or the `skipGatewayAuthorization` flag is not set, the client will automatically grant access
   * to the Storacha Gateway by default (https://freewaying.dag.haus/).
   *
   * @typedef {import('./types.js').ConnectionView<import('./types.js').ContentServeService>} ConnectionView
   *
   * @typedef {object} SpaceCreateOptions
   * @property {Account.Account} [account] - The account configured as the recovery account for the space.
   * @property {Array<ConnectionView>} [authorizeGatewayServices] - The DID Key or DID Web of the Gateway to authorize to serve content from the created space.
   * @property {boolean} [skipGatewayAuthorization] - Whether to skip the Gateway authorization. It means that the content of the space will not be served by any Gateway.
   *
   * @param {string} name - The name of the space to create.
   * @param {SpaceCreateOptions} [options] - Options for the space creation.
   * @returns {Promise<import("./space.js").OwnedSpace>} The created space owned by the agent.
   */
  async createSpace(name, options) {
    const space = await this._agent.createSpace(name);
    const account = options?.account;
    if (account) {
      const provisionResult = await account.provision(space.did());
      if (provisionResult.error) {
        throw new Error(
          `failed to provision account: ${provisionResult.error.message}`,
          { cause: provisionResult.error }
        );
      }
      await space.save();
      const recovery = await space.createRecovery(account.did());
      const delegationResult = await this.capability.access.delegate({
        space: space.did(),
        delegations: [recovery]
      });
      if (delegationResult.error) {
        throw new Error(
          `failed to authorize recovery account: ${delegationResult.error.message}`,
          { cause: delegationResult.error }
        );
      }
    }
    if (options?.skipGatewayAuthorization !== true) {
      let authorizeGatewayServices = options?.authorizeGatewayServices;
      if (!authorizeGatewayServices || authorizeGatewayServices.length === 0) {
        authorizeGatewayServices = [
          UcantoClient.connect({
            id: {
              did: () => (
                /** @type {`did:${string}:${string}`} */
                /* c8 ignore next - default prod gateway id is not used in tests */
                process.env.DEFAULT_GATEWAY_ID ?? "did:web:w3s.link"
              )
            },
            codec: CAR2.outbound,
            channel: import_transport2.HTTP.open({
              url: new URL(
                /* c8 ignore next - default prod gateway url is not used in tests */
                process.env.DEFAULT_GATEWAY_URL ?? "https://w3s.link"
              )
            })
          })
        ];
      }
      await space.save();
      for (const serviceConnection of authorizeGatewayServices) {
        await authorizeContentServe(this, space, serviceConnection);
      }
    }
    return space;
  }
  /**
   * Share an existing space with another Storacha account via email address delegation.
   * Delegates access to the space to the specified email account with the following permissions:
   * - space/* - for managing space metadata
   * - blob/* - for managing blobs
   * - store/* - for managing stores
   * - upload/*- for registering uploads
   * - access/* - for re-delegating access to other devices
   * - filecoin/* - for submitting to the filecoin pipeline
   * - usage/* - for querying usage
   * The default expiration is set to infinity.
   *
   * @typedef {object} ShareOptions
   * @property {import('./types.js').ServiceAbility[]} abilities - Abilities to delegate to the delegate account.
   * @property {number} expiration - Expiration time in seconds.
   
   * @param {import("./types.js").EmailAddress} delegateEmail - Email of the account to share the space with.
   * @param {import('./types.js').SpaceDID} spaceDID - The DID of the space to share.
   * @param {ShareOptions} [options] - Options for the delegation.
   *
   * @returns {Promise<import('./delegation.js').AgentDelegation<any>>} Resolves with the AgentDelegation instance once the space is successfully shared.
   * @throws {Error} - Throws an error if there is an issue delegating access to the space.
   */
  async shareSpace(delegateEmail, spaceDID, options = {
    abilities: [
      "space/*",
      "store/*",
      "upload/*",
      "access/*",
      "usage/*",
      "filecoin/*"
    ],
    expiration: Infinity
  }) {
    const { abilities, ...restOptions } = options;
    const currentSpace = this.agent.currentSpace();
    try {
      await this.agent.setCurrentSpace(spaceDID);
      const { root, blocks } = await this.agent.delegate({
        ...restOptions,
        abilities,
        audience: {
          did: () => DIDMailto2.fromEmail(DIDMailto2.email(delegateEmail))
        },
        // @ts-expect-error audienceMeta is not defined in ShareOptions
        audienceMeta: options.audienceMeta ?? {}
      });
      const delegation = new AgentDelegation(root, blocks, {
        audience: delegateEmail
      });
      const sharingResult = await this.capability.access.delegate({
        space: spaceDID,
        delegations: [delegation]
      });
      if (sharingResult.error) {
        throw new Error(
          `failed to share space with ${delegateEmail}: ${sharingResult.error.message}`,
          {
            cause: sharingResult.error
          }
        );
      }
      return delegation;
    } finally {
      if (currentSpace && currentSpace !== spaceDID) {
        await this.agent.setCurrentSpace(currentSpace);
      }
    }
  }
  /* c8 ignore stop */
  /**
   * Add a space from a received proof.
   *
   * @param {import('./types.js').Delegation} proof
   */
  async addSpace(proof) {
    return await this._agent.importSpaceFromDelegation(proof);
  }
  /**
   * Get all the proofs matching the capabilities.
   *
   * Proofs are delegations with an _audience_ matching the agent DID.
   *
   * @param {import('./types.js').Capability[]} [caps] - Capabilities to
   * filter by. Empty or undefined caps with return all the proofs.
   */
  proofs(caps) {
    return this._agent.proofs(caps);
  }
  /**
   * Add a proof to the agent. Proofs are delegations with an _audience_
   * matching the agent DID.
   *
   * @param {import('./types.js').Delegation} proof
   */
  async addProof(proof) {
    await this._agent.addProof(proof);
  }
  /**
   * Get delegations created by the agent for others.
   *
   * @param {import('./types.js').Capability[]} [caps] - Capabilities to
   * filter by. Empty or undefined caps with return all the delegations.
   */
  delegations(caps) {
    const delegations = [];
    for (const { delegation, meta } of this._agent.delegationsWithMeta(caps)) {
      delegations.push(
        new AgentDelegation(delegation.root, delegation.blocks, meta)
      );
    }
    return delegations;
  }
  /**
   * Create a delegation to the passed audience for the given abilities with
   * the _current_ space as the resource.
   *
   * @param {import('./types.js').Principal} audience
   * @param {import('./types.js').ServiceAbility[]} abilities
   * @param {Omit<import('./types.js').UCANOptions, 'audience'> & { audienceMeta?: import('./types.js').AgentMeta }} [options]
   */
  async createDelegation(audience, abilities, options = {}) {
    const audienceMeta = options.audienceMeta ?? {
      name: "agent",
      type: "device"
    };
    const { root, blocks } = await this._agent.delegate({
      ...options,
      abilities,
      audience,
      audienceMeta
    });
    return new AgentDelegation(root, blocks, { audience: audienceMeta });
  }
  /**
   * Revoke a delegation by CID.
   *
   * If the delegation was issued by this agent (and therefore is stored in the
   * delegation store) you can just pass the CID. If not, or if the current agent's
   * delegation store no longer contains the delegation, you MUST pass a chain of
   * proofs that proves your authority to revoke this delegation as `options.proofs`.
   *
   * @param {import('@ucanto/interface').UCANLink} delegationCID
   * @param {object} [options]
   * @param {import('@ucanto/interface').Delegation[]} [options.proofs]
   */
  async revokeDelegation(delegationCID, options = {}) {
    return this._agent.revoke(delegationCID, {
      proofs: options.proofs
    });
  }
  /**
   * Removes association of a content CID with the space. Optionally, also removes
   * association of CAR shards with space.
   *
   * ⚠️ If `shards` option is `true` all shards will be deleted even if there is another upload(s) that
   * reference same shards, which in turn could corrupt those uploads.
   *
   * Required delegated capabilities:
   * - `space/blob/remove`
   * - `store/remove`
   * - `upload/get`
   * - `upload/remove`
   *
   * @param {import('multiformats').UnknownLink} contentCID
   * @param {object} [options]
   * @param {boolean} [options.shards]
   */
  async remove(contentCID, options = {}) {
    if (!options.shards) {
      await this.capability.upload.remove(contentCID);
      return;
    }
    const upload = await this.capability.upload.get(contentCID);
    if (upload.shards?.length) {
      await Promise.allSettled(
        upload.shards.map(async (shard) => {
          try {
            const res = await this.capability.blob.remove(shard.multihash);
            if (res.ok && res.ok.size === 0) {
              await this.capability.store.remove(shard);
            }
          } catch (error2) {
            if (error2?.cause?.name !== "StoreItemNotFound") {
              throw new Error(`failed to remove shard: ${shard}`, {
                cause: error2
              });
            }
          }
        })
      );
    }
    await this.capability.upload.remove(contentCID);
  }
};
var authorizeContentServe = async (client2, space, connection, options = {}) => {
  const currentSpace = client2.currentSpace();
  try {
    await client2.setCurrentSpace(space.did());
    const audience = {
      did: () => options.audience ?? connection.id.did()
    };
    const delegation = await client2.createDelegation(
      audience,
      [import_capabilities9.Space.contentServe.can],
      {
        expiration: options.expiration ?? Infinity
      }
    );
    const accessProofs = client2.proofs([
      { can: import_capabilities9.Access.access.can, with: space.did() }
    ]);
    const verificationResult = await import_capabilities9.Access.delegate.invoke({
      issuer: client2.agent.issuer,
      audience,
      with: space.did(),
      proofs: [...accessProofs, delegation],
      nb: {
        delegations: {
          [delegation.cid.toString()]: delegation.cid
        }
      }
    }).execute(connection);
    if (verificationResult.out.error) {
      throw new Error(
        `failed to publish delegation for audience ${audience.did()}: ${verificationResult.out.error.message}`,
        {
          cause: verificationResult.out.error
        }
      );
    }
    return { ok: { ...verificationResult.out.ok, delegation } };
  } finally {
    if (currentSpace) {
      await client2.setCurrentSpace(currentSpace.did());
    }
  }
};

// src/ability.js
var import_capabilities10 = require("@web3-storage/capabilities");
var setOfAbilities = new Set(import_capabilities10.abilitiesAsStrings);
function asAbilities(abilities) {
  for (const ability of abilities) {
    if (!setOfAbilities.has(
      /** @type {import('@web3-storage/capabilities/types').ServiceAbility} */
      ability
    )) {
      throw new Error(`${ability} is not a supported capability`);
    }
  }
  return (
    /** @type {import('@web3-storage/capabilities/types').ServiceAbility[]} */
    abilities
  );
}

// src/index.js
async function create(options = {}) {
  const store = options.store ?? new import_store_indexeddb.StoreIndexedDB("w3up-client");
  const raw = await store.load();
  if (raw) {
    const data2 = import_agent3.AgentData.fromExport(raw, { store });
    if (options.principal && data2.principal.did() !== options.principal.did()) {
      throw new Error(
        `store cannot be used with ${options.principal.did()}, stored principal and passed principal must match`
      );
    }
    return new Client(data2, options);
  }
  const principal = options.principal ?? await (0, import_rsa.generate)();
  const data = await import_agent3.AgentData.create({ principal }, { store });
  return new Client(data, options);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Account,
  Client,
  Result,
  asAbilities,
  authorizeContentServe,
  create
});
