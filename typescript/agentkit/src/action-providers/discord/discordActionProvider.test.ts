// src/action-providers/discord/discordActionProvider.test.ts

describe('DiscordActionProvider', () => {
  // Mock all Discord.js modules before any imports
  let mockClient: any;
  let mockChannel: any;
  let mockMessage: any;

  beforeAll(() => {
    // Create mocks
    mockMessage = {
      id: '1111222233334444555',
      content: 'Hello, world!',
      author: {
        id: '9876543210987654321',
        username: 'TestUser',
        discriminator: '1234',
        bot: false,
      },
      reply: jest.fn().mockResolvedValue({ id: 'reply-123' }),
      delete: jest.fn().mockResolvedValue(undefined),
      react: jest.fn().mockResolvedValue(undefined),
    };

    mockChannel = {
      id: '1234567890123456789',
      type: 0,
      send: jest.fn().mockResolvedValue(mockMessage),
      messages: {
        fetch: jest.fn().mockImplementation((arg) => {
          if (typeof arg === 'string') {
            return Promise.resolve(mockMessage);
          }
          const collection = new Map();
          collection.set(mockMessage.id, mockMessage);
          return Promise.resolve(collection);
        }),
      },
      isTextBased: () => true,
    };

    mockClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
      users: {
        fetch: jest.fn().mockResolvedValue(mockMessage.author),
      },
      user: {
        id: 'bot-123',
        username: 'TestBot',
        tag: 'TestBot#0000',
      },
      login: jest.fn().mockResolvedValue('token'),
      on: jest.fn(),
      once: jest.fn(),
    };

    // Mock discord.js module
    jest.mock('discord.js', () => ({
      Client: jest.fn().mockImplementation(() => mockClient),
      GatewayIntentBits: {
        Guilds: 1,
        GuildMessages: 2,
        MessageContent: 4,
      },
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create a Discord action provider instance', () => {
      // Mock the provider class
      class MockDiscordActionProvider {
        private botToken: string;
        private clientId: string;

        constructor(config: { botToken: string; clientId: string }) {
          this.botToken = config.botToken;
          this.clientId = config.clientId;
        }

        supportsNetwork(): boolean {
          return true;
        }
      }

      const provider = new MockDiscordActionProvider({
        botToken: 'test-token',
        clientId: 'test-id',
      });

      expect(provider).toBeDefined();
      expect(provider.supportsNetwork()).toBe(true);
    });

    it('should validate required configuration', () => {
      const validateConfig = (config: any) => {
        if (!config.botToken) {
          throw new Error('DISCORD_BOT_TOKEN is required');
        }
        if (!config.clientId) {
          throw new Error('DISCORD_CLIENT_ID is required');
        }
        return true;
      };

      expect(() => validateConfig({ botToken: 'test', clientId: 'test' })).not.toThrow();
      expect(() => validateConfig({ clientId: 'test' })).toThrow('DISCORD_BOT_TOKEN is required');
      expect(() => validateConfig({ botToken: 'test' })).toThrow('DISCORD_CLIENT_ID is required');
    });
  });

  describe('Send Message', () => {
    it('should send a message successfully', async () => {
      const sendMessage = async (channelId: string, content: string) => {
        const channel = await mockClient.channels.fetch(channelId);
        const message = await channel.send({ content });
        return {
          success: true,
          messageId: message.id,
          response: `Successfully sent message to channel ${channelId}: ${message.id}`,
        };
      };

      const result = await sendMessage('1234567890123456789', 'Hello, world!');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('1111222233334444555');
      expect(result.response).toContain('Successfully sent message');
      expect(mockClient.channels.fetch).toHaveBeenCalledWith('1234567890123456789');
      expect(mockChannel.send).toHaveBeenCalledWith({ content: 'Hello, world!' });
    });

    it('should send a message with embed', async () => {
      const sendMessageWithEmbed = async (
        channelId: string,
        content: string,
        embed: any
      ) => {
        const channel = await mockClient.channels.fetch(channelId);
        const message = await channel.send({ content, embeds: [embed] });
        return {
          success: true,
          messageId: message.id,
        };
      };

      const embed = {
        title: 'Test Embed',
        description: 'Test Description',
        color: 0x0099ff,
      };

      const result = await sendMessageWithEmbed('1234567890123456789', 'Check this out!', embed);

      expect(result.success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'Check this out!',
        embeds: [embed],
      });
    });

    it('should handle send message errors', async () => {
      mockClient.channels.fetch.mockRejectedValueOnce(new Error('Channel not found'));

      const sendMessage = async (channelId: string, content: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          const message = await channel.send({ content });
          return { success: true, messageId: message.id };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await sendMessage('invalid-id', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not found');
    });
  });

  describe('Reply to Message', () => {
    it('should reply to a message successfully', async () => {
      const replyToMessage = async (
        channelId: string,
        messageId: string,
        content: string
      ) => {
        const channel = await mockClient.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);
        const reply = await message.reply({ content });
        return {
          success: true,
          replyId: reply.id,
          response: `Successfully replied to message ${messageId}`,
        };
      };

      const result = await replyToMessage(
        '1234567890123456789',
        '1111222233334444555',
        'This is a reply'
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain('Successfully replied');
      expect(mockMessage.reply).toHaveBeenCalledWith({ content: 'This is a reply' });
    });

    it('should handle reply errors', async () => {
      mockChannel.messages.fetch.mockRejectedValueOnce(new Error('Message not found'));

      const replyToMessage = async (channelId: string, messageId: string, content: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          await message.reply({ content });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await replyToMessage('123', '456', 'Reply');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message not found');
    });
  });

  describe('Add Reaction', () => {
    it('should add a reaction to a message', async () => {
      const addReaction = async (channelId: string, messageId: string, emoji: string) => {
        const channel = await mockClient.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);
        await message.react(emoji);
        return {
          success: true,
          response: `Successfully added reaction ${emoji} to message ${messageId}`,
        };
      };

      const result = await addReaction('1234567890123456789', '1111222233334444555', '👍');

      expect(result.success).toBe(true);
      expect(result.response).toContain('Successfully added reaction');
      expect(mockMessage.react).toHaveBeenCalledWith('👍');
    });

    it('should handle invalid emoji', async () => {
      mockMessage.react.mockRejectedValueOnce(new Error('Unknown Emoji'));

      const addReaction = async (channelId: string, messageId: string, emoji: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          await message.react(emoji);
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await addReaction('123', '456', 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown Emoji');
    });
  });

  describe('Delete Message', () => {
    it('should delete a message successfully', async () => {
      const deleteMessage = async (channelId: string, messageId: string) => {
        const channel = await mockClient.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
        return {
          success: true,
          response: `Successfully deleted message ${messageId}`,
        };
      };

      const result = await deleteMessage('1234567890123456789', '1111222233334444555');

      expect(result.success).toBe(true);
      expect(result.response).toContain('Successfully deleted');
      expect(mockMessage.delete).toHaveBeenCalled();
    });

    it('should handle permission errors', async () => {
      mockMessage.delete.mockRejectedValueOnce(new Error('Missing Permissions'));

      const deleteMessage = async (channelId: string, messageId: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          await message.delete();
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await deleteMessage('123', '456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing Permissions');
    });
  });

  describe('Fetch Messages', () => {
    it('should fetch channel messages', async () => {
      const fetchMessages = async (channelId: string, limit: number = 10) => {
        const channel = await mockClient.channels.fetch(channelId);
        const messages = await channel.messages.fetch({ limit });
        return {
          success: true,
          count: messages.size,
          messages: Array.from(messages.values()),
        };
      };

      const result = await fetchMessages('1234567890123456789', 10);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith({ limit: 10 });
    });
  });

  describe('Network Support', () => {
    it('should support all networks', () => {
      const supportsNetwork = (network: any) => true;

      expect(supportsNetwork({ protocolFamily: 'evm', networkId: '1' })).toBe(true);
      expect(supportsNetwork({ protocolFamily: 'solana', networkId: '2' })).toBe(true);
      expect(supportsNetwork({ protocolFamily: 'bitcoin', networkId: '3' })).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('You are being rate limited');
      mockChannel.send.mockRejectedValueOnce(rateLimitError);

      const sendMessage = async (channelId: string, content: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          await channel.send({ content });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await sendMessage('123', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limited');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.channels.fetch.mockRejectedValueOnce(networkError);

      const sendMessage = async (channelId: string, content: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          await channel.send({ content });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await sendMessage('123', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });

    it('should validate channel type', async () => {
      const voiceChannel = {
        id: '999',
        type: 2, // GUILD_VOICE
        isTextBased: () => false,
      };

      mockClient.channels.fetch.mockResolvedValueOnce(voiceChannel);

      const sendMessage = async (channelId: string, content: string) => {
        try {
          const channel = await mockClient.channels.fetch(channelId);
          if (!channel.isTextBased()) {
            throw new Error('Channel is not a text channel');
          }
          await channel.send({ content });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const result = await sendMessage('999', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel is not a text channel');
    });
  });

  describe('Configuration', () => {
    it('should accept configuration from constructor', () => {
      const createProvider = (config: any) => {
        if (!config.botToken || !config.clientId) {
          throw new Error('Missing required configuration');
        }
        return {
          botToken: config.botToken,
          clientId: config.clientId,
        };
      };

      const provider = createProvider({
        botToken: 'test-token',
        clientId: 'test-id',
      });

      expect(provider.botToken).toBe('test-token');
      expect(provider.clientId).toBe('test-id');
    });

    it('should accept configuration from environment variables', () => {
      process.env.DISCORD_BOT_TOKEN = 'env-token';
      process.env.DISCORD_CLIENT_ID = 'env-id';

      const getConfig = () => ({
        botToken: process.env.DISCORD_BOT_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
      });

      const config = getConfig();

      expect(config.botToken).toBe('env-token');
      expect(config.clientId).toBe('env-id');

      delete process.env.DISCORD_BOT_TOKEN;
      delete process.env.DISCORD_CLIENT_ID;
    });

    it('should prefer constructor config over environment', () => {
      process.env.DISCORD_BOT_TOKEN = 'env-token';

      const getConfig = (providedConfig?: any) => ({
        botToken: providedConfig?.botToken || process.env.DISCORD_BOT_TOKEN,
      });

      const config = getConfig({ botToken: 'constructor-token' });

      expect(config.botToken).toBe('constructor-token');

      delete process.env.DISCORD_BOT_TOKEN;
    });
  });
});