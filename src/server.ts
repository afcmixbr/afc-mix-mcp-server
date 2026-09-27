import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

interface Env {
  MCP_API_KEY: string;
  AFC_BACKEND: Fetcher;
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "AFC Mix Mercado Livre",
    version: "1.0.0",
  });

  async function callBackend(path: string) {
    const response = await env.AFC_BACKEND.fetch(
      `https://afc-backend${path}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": env.MCP_API_KEY,
          Accept: "application/json",
        },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Erro no backend AFC Mix (${response.status}): ${text}`
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  server.registerTool(
    "afc_conta",
    {
      description:
        "Consulta os dados da conta da AFC Mix no Mercado Livre, incluindo identificação e reputação do vendedor.",
      inputSchema: {},
    },
    async () => {
      const data = await callBackend("/ml/me");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "afc_vendas",
    {
      description:
        "Consulta vendas da AFC Mix no Mercado Livre, incluindo faturamento, pedidos, itens, unidades físicas, ticket médio e ranking de produtos.",
      inputSchema: {
        periodo: z
          .enum(["hoje", "ontem", "7d", "30d"])
          .default("hoje")
          .describe(
            "Período: hoje, ontem, últimos 7 dias ou últimos 30 dias."
          ),
      },
    },
    async ({ periodo }) => {
      const data = await callBackend(
        `/ml/orders?period=${encodeURIComponent(periodo)}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "afc_comparar_vendas",
    {
      description:
        "Compara o desempenho comercial da AFC Mix com o período anterior equivalente, incluindo faturamento, pedidos, ticket médio e desempenho por anúncio.",
      inputSchema: {
        periodo: z
          .enum(["hoje", "7d", "30d"])
          .default("7d")
          .describe(
            "Período que será comparado com o período anterior equivalente."
          ),
      },
    },
    async ({ periodo }) => {
      const data = await callBackend(
        `/ml/comparison?period=${encodeURIComponent(periodo)}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const handler = createMcpHandler(() => createServer(env));

    return handler(request, env, ctx);
  },
};
