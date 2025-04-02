import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ResourceGraphClient } from "@azure/arm-resourcegraph";
import { DefaultAzureCredential } from "@azure/identity";
import { config } from "dotenv";

// Load environment variables
config();

const subscriptionId = process.env.SUBSCRIPTION_ID || "";
console.error("Using subscription ID:", subscriptionId);

// Create an MCP server
const server = new McpServer({
  name: "AzureResourceGraph",
  version: "1.0.0",
});

// Initialize Azure Resource Graph client
let rgClient: ResourceGraphClient;

try {
  // Create Azure clients using DefaultAzureCredential
  const credential = new DefaultAzureCredential();
  rgClient = new ResourceGraphClient(credential);
  console.error("Azure Resource Graph client initialized successfully");
} catch (err) {
  console.error("Failed to initialize Azure Resource Graph client:", err);
  process.exit(1);
}

try {
  const operations2 = await rgClient.resources({
    subscriptions: [process.env.SUBSCRIPTION_ID || ""],
    query: "Resources | project id, name, type, location",
  });
  console.log("Operations:", JSON.stringify(operations2, null, 2));
} catch (err) {
  console.log("An error occurred:");
  console.error(err);
}


// Add a tool to query resources
server.tool(
  "query-resources",
  "Retrieves resources and their details from Azure Resource Graph",
  {
    subscriptionId: z
      .string()
      .describe("Azure subscription ID")
      .default(process.env.SUBSCRIPTION_ID || ""),
    query: z
      .string()
      .optional()
      .describe("Resource Graph query, defaults to listing all resources"),
  },
  async ({ subscriptionId, query }) => {
    try {
      const defaultQuery = "Resources | project id, name, type, location";
      const queryToUse = query || defaultQuery;

      const resources = await rgClient.resources({
        subscriptions: [subscriptionId],
        query: queryToUse,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resources, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error querying resources: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Azure Resource Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
