require("dotenv").config();

const axios = require("axios");

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");

const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");

const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const server = new Server(
  {
    name: "upstox",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_nifty_spot",
        description: "Get live NIFTY spot price",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {

  if (request.params.name === "get_nifty_spot") {

    const response = await axios.get(
      "https://api.upstox.com/v2/market-quote/quotes",
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
        params: {
          instrument_key: "NSE_INDEX|Nifty 50",
        },
      }
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  throw new Error("Unknown tool");
});

async function main() {

  const transport = new StdioServerTransport();

  await server.connect(transport);

}

main();