declare module 'confluence-api' {
  interface ConfluenceConfig {
    username: string;
    password: string;
    baseUrl: string;
  }

  interface ConfluenceContent {
    id: string;
    type: string;
    title: string;
    body: {
      storage: {
        value: string;
        representation: string;
      };
    };
    version: {
      number: number;
    };
  }

  class ConfluenceClient {
    constructor(config: ConfluenceConfig);
    getContentById(spaceKey: string, pageId: string): Promise<ConfluenceContent>;
    putContent(spaceKey: string, pageId: string, content: ConfluenceContent): Promise<ConfluenceContent>;
  }

  export = ConfluenceClient;
} 