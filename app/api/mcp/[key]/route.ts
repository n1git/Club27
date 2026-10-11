import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyMigration, markMigrationApplied, migrationStatus } from "@/lib/mcp/migrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROTOCOL_VERSION = "2025-06-18";
const versionInput = z.object({ version: z.string().regex(/^\d{14}$/, "Versi harus 14 digit, mis. 20250101000033") });

const TOOLS = [
  {
    name: "migration_status",
    description: "Daftar migrasi di repo dan apakah sudah tercatat di database production.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "apply_migration",
    description:
      "Menjalankan satu file migrasi dari folder supabase/migrations di repo (bukan SQL bebas) dalam satu transaksi, lalu mencatatnya. Migrasi sebelumnya harus sudah tercatat.",
    inputSchema: {
      type: "object",
      properties: { version: { type: "string", description: "Awalan 14 digit nama file migrasi" } },
      required: ["version"],
    },
  },
  {
    name: "mark_migration_applied",
    description:
      "Mencatat migrasi dari repo sebagai sudah diterapkan tanpa menjalankannya. Hanya untuk migrasi yang sudah diterapkan dengan cara lain.",
    inputSchema: {
      type: "object",
      properties: { version: { type: "string", description: "Awalan 14 digit nama file migrasi" } },
      required: ["version"],
    },
  },
];

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function authorized(key: string) {
  const secret = process.env.MCP_CONNECTOR_KEY;
  if (!secret || secret.length < 32) return false;
  return timingSafeEqual(digest(key), digest(secret));
}

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function text(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function callTool(name: string, args: unknown) {
  try {
    switch (name) {
      case "migration_status":
        return text(await migrationStatus());
      case "apply_migration":
        return text(`Diterapkan: ${await applyMigration(versionInput.parse(args).version)}`);
      case "mark_migration_applied":
        return text(`Dicatat: ${await markMigrationApplied(versionInput.parse(args).version)}`);
      default:
        return text(`Tool tidak dikenal: ${name}`, true);
    }
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : String(error);
    return text(message ?? "Gagal", true);
  }
}

async function handle(message: RpcMessage) {
  const id = message.id ?? null;
  switch (message.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "club27-db", version: "1.0.0" },
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call":
      return {
        jsonrpc: "2.0",
        id,
        result: await callTool(String(message.params?.name ?? ""), message.params?.arguments ?? {}),
      };
    default:
      if (message.id === undefined) return null;
      return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!authorized((await params).key)) return new NextResponse(null, { status: 404 });

  let body: RpcMessage | RpcMessage[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const message of messages) {
    const response = await handle(message);
    if (response) responses.push(response);
  }
  if (!responses.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!authorized((await params).key)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
