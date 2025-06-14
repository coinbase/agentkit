declare module "@modelcontextprotocol/sdk/server" {
  export interface ServerInfo {
    name: string;
    version: string;
    description?: string;
  }

  export interface ServerOptions {
    capabilities: {
      tools?: {};
    };
  }

  export class Server {
    constructor(info: ServerInfo, options: ServerOptions);
    setRequestHandler(method: string, handler: (request: any) => Promise<any>): void;
    connect(transport: any): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/stdio" {
  export class StdioServerTransport {
    constructor();
  }
}