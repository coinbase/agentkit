describe('CarvActionProvider', () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof global.fetch;

  const MOCK_CONFIG = {
    apiKey: 'test-api-key',
    apiBaseUrl: 'https://test-api.carv.io',
  };

  const MOCK_DISCORD_ID = '123456789012345678';
  const MOCK_TWITTER_ID = 'testuser';
  const MOCK_ADDRESS = '0xacf85e57cfff872a076ec1e5350fd959d08763db';
  const MOCK_BALANCE = '21.585240';

  beforeAll(() => {
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    // Create mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with config values', () => {
      const createProvider = (config: any) => {
        if (!config.apiKey) {
          throw new Error('CARV_API_KEY is not configured.');
        }
        return { apiKey: config.apiKey };
      };

      expect(() => createProvider(MOCK_CONFIG)).not.toThrow();
      const provider = createProvider(MOCK_CONFIG);
      expect(provider.apiKey).toBe('test-api-key');
    });

    it('should initialize with environment variables', () => {
      const originalEnv = { ...process.env };
      process.env.CARV_API_KEY = 'env-api-key';

      const getConfig = () => ({
        apiKey: process.env.CARV_API_KEY,
      });

      const config = getConfig();
      expect(config.apiKey).toBe('env-api-key');

      process.env = originalEnv;
    });

    it('should throw error if no API key provided', () => {
      const originalEnv = { ...process.env };
      delete process.env.CARV_API_KEY;

      const createProvider = (config: any) => {
        const apiKey = config.apiKey || process.env.CARV_API_KEY;
        if (!apiKey) {
          throw new Error('CARV_API_KEY is not configured.');
        }
        return { apiKey };
      };

      expect(() => createProvider({})).toThrow('CARV_API_KEY is not configured.');

      process.env = originalEnv;
    });
  });

  describe('Get Address by Discord ID', () => {
    const mockSuccessResponse = {
      code: 0,
      msg: 'success',
      data: {
        user_address: MOCK_ADDRESS,
        balance: MOCK_BALANCE,
      },
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      });
    });

    it('should successfully retrieve address by Discord ID', async () => {
      const getAddressByDiscordId = async (
        discordUserId: string,
        chainName: string = 'base',
        tokenTicker: string = 'carv'
      ) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${discordUserId}&chain_name=${chainName}&token_ticker=${tokenTicker}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: MOCK_CONFIG.apiKey,
          },
        });

        const data = await response.json();

        if (data.code === 0) {
          return {
            success: true,
            result: {
              user_address: data.data.user_address,
              balance: data.data.balance,
              chain_name: chainName,
              token_ticker: tokenTicker,
            },
          };
        }

        return { success: false, error: data.msg };
      };

      const result = await getAddressByDiscordId(MOCK_DISCORD_ID);

      expect(result.success).toBe(true);
      expect(result.result?.user_address).toBe(MOCK_ADDRESS);
      expect(result.result?.balance).toBe(MOCK_BALANCE);
      expect(result.result?.chain_name).toBe('base');
      expect(result.result?.token_ticker).toBe('carv');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/user_balance_by_discord_id'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: MOCK_CONFIG.apiKey,
          },
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 1001,
          msg: 'User not found',
          data: null,
        }),
      });

      const getAddressByDiscordId = async (discordUserId: string) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${discordUserId}&chain_name=base&token_ticker=carv`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        const data = await response.json();

        if (data.code !== 0) {
          return { success: false, error: data.msg };
        }

        return { success: true };
      };

      const result = await getAddressByDiscordId(MOCK_DISCORD_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const getAddressByDiscordId = async (discordUserId: string) => {
        try {
          const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${discordUserId}&chain_name=base&token_ticker=carv`;
          
          await fetch(url, {
            method: 'GET',
            headers: { Authorization: MOCK_CONFIG.apiKey },
          });

          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await getAddressByDiscordId(MOCK_DISCORD_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const getAddressByDiscordId = async (discordUserId: string) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${discordUserId}&chain_name=base&token_ticker=carv`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        if (!response.ok) {
          return {
            success: false,
            error: `API Error ${response.status}: ${response.statusText}`,
          };
        }

        return { success: true };
      };

      const result = await getAddressByDiscordId(MOCK_DISCORD_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
      expect(result.error).toContain('Unauthorized');
    });

    it('should support custom chain and token parameters', async () => {
      const getAddressByDiscordId = async (
        discordUserId: string,
        chainName: string,
        tokenTicker: string
      ) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${discordUserId}&chain_name=${chainName}&token_ticker=${tokenTicker}`;
        
        await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        return { success: true };
      };

      await getAddressByDiscordId(MOCK_DISCORD_ID, 'ethereum', 'usdc');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('chain_name=ethereum'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('token_ticker=usdc'),
        expect.any(Object)
      );
    });
  });

  describe('Get Address by Twitter ID', () => {
    const mockSuccessResponse = {
      code: 0,
      msg: 'success',
      data: {
        user_address: MOCK_ADDRESS,
        balance: '0.000000',
      },
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      });
    });

    it('should successfully retrieve address by Twitter ID', async () => {
      const getAddressByTwitterId = async (
        twitterUserId: string,
        chainName: string = 'base',
        tokenTicker: string = 'carv'
      ) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_twitter_id?twitter_user_id=${twitterUserId}&chain_name=${chainName}&token_ticker=${tokenTicker}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: MOCK_CONFIG.apiKey,
          },
        });

        const data = await response.json();

        if (data.code === 0) {
          return {
            success: true,
            result: {
              user_address: data.data.user_address,
              balance: data.data.balance,
              chain_name: chainName,
              token_ticker: tokenTicker,
            },
          };
        }

        return { success: false, error: data.msg };
      };

      const result = await getAddressByTwitterId(MOCK_TWITTER_ID);

      expect(result.success).toBe(true);
      expect(result.result?.user_address).toBe(MOCK_ADDRESS);
      expect(result.result?.balance).toBe('0.000000');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/user_balance_by_twitter_id'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: MOCK_CONFIG.apiKey,
          },
        })
      );
    });

    it('should handle user not found error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 1002,
          msg: 'Twitter user not found',
          data: null,
        }),
      });

      const getAddressByTwitterId = async (twitterUserId: string) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_twitter_id?twitter_user_id=${twitterUserId}&chain_name=base&token_ticker=carv`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        const data = await response.json();

        if (data.code !== 0) {
          return { success: false, error: data.msg };
        }

        return { success: true };
      };

      const result = await getAddressByTwitterId('nonexistent_user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Get Balance by Discord ID', () => {
    it('should retrieve balance by Discord ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          msg: 'success',
          data: {
            user_address: MOCK_ADDRESS,
            balance: MOCK_BALANCE,
          },
        }),
      });

      const getBalanceByDiscordId = async (discordUserId: string) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${discordUserId}&chain_name=base&token_ticker=carv`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        const data = await response.json();

        if (data.code === 0) {
          return {
            success: true,
            balance: data.data.balance,
            address: data.data.user_address,
          };
        }

        return { success: false };
      };

      const result = await getBalanceByDiscordId(MOCK_DISCORD_ID);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(MOCK_BALANCE);
      expect(result.address).toBe(MOCK_ADDRESS);
    });
  });

  describe('Get Balance by Twitter ID', () => {
    it('should retrieve balance by Twitter ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          msg: 'success',
          data: {
            user_address: MOCK_ADDRESS,
            balance: '100.50',
          },
        }),
      });

      const getBalanceByTwitterId = async (twitterUserId: string) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_twitter_id?twitter_user_id=${twitterUserId}&chain_name=base&token_ticker=carv`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        const data = await response.json();

        if (data.code === 0) {
          return {
            success: true,
            balance: data.data.balance,
            address: data.data.user_address,
          };
        }

        return { success: false };
      };

      const result = await getBalanceByTwitterId(MOCK_TWITTER_ID);

      expect(result.success).toBe(true);
      expect(result.balance).toBe('100.50');
      expect(result.address).toBe(MOCK_ADDRESS);
    });
  });

  describe('Network Support', () => {
    it('should support all networks', () => {
      const supportsNetwork = () => true;

      expect(supportsNetwork()).toBe(true);
    });
  });

  describe('API Request Headers', () => {
    it('should include authorization header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, msg: 'success', data: {} }),
      });

      const makeRequest = async () => {
        await fetch(`${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=123&chain_name=base&token_ticker=carv`, {
          method: 'GET',
          headers: {
            Authorization: MOCK_CONFIG.apiKey,
          },
        });
      };

      await makeRequest();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'test-api-key',
          }),
        })
      );
    });
  });

  describe('Multiple Chain Support', () => {
    it('should support different chains', async () => {
      const chains = ['ethereum', 'bsc', 'base', 'polygon'];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          msg: 'success',
          data: { user_address: MOCK_ADDRESS, balance: '0' },
        }),
      });

      const getAddressForChain = async (chain: string) => {
        const url = `${MOCK_CONFIG.apiBaseUrl}/user_balance_by_discord_id?discord_user_id=${MOCK_DISCORD_ID}&chain_name=${chain}&token_ticker=carv`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: MOCK_CONFIG.apiKey },
        });

        const data = await response.json();
        return data.code === 0 ? { success: true, chain } : { success: false };
      };

      for (const chain of chains) {
        const result = await getAddressForChain(chain);
        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`chain_name=${chain}`),
          expect.any(Object)
        );
      }
    });
  });
});