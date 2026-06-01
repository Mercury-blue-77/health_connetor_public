import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import type { Request, Response } from "express";
import { config } from "../config.js";

const forwardedRequestHeaders = [
  "accept",
  "content-type",
  "mcp-session-id",
  "mcp-protocol-version",
];

const skippedResponseHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
]);

export async function proxyMcpRequest(req: Request, res: Response) {
  if (!config.sparkyMcpBearerToken) {
    res.status(500).json({
      error: "upstream_not_configured",
      error_description: "SPARKY_MCP_BEARER_TOKEN is required.",
    });
    return;
  }

  const upstreamUrl = new URL(config.sparkyMcpUrl);
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value)) {
      for (const item of value) upstreamUrl.searchParams.append(key, String(item));
    } else if (value !== undefined) {
      upstreamUrl.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers();
  for (const headerName of forwardedRequestHeaders) {
    const value = req.header(headerName);
    if (value) headers.set(headerName, value);
  }
  headers.set("authorization", `Bearer ${config.sparkyMcpBearerToken}`);

  let upstreamResponse: globalThis.Response;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.upstreamRequestTimeoutMs,
  );
  timeout.unref();
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: hasBody(req.method) ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
    });
  } catch {
    res.status(502).json({
      error: "upstream_unavailable",
      error_description: "Could not reach the upstream Sparky MCP server.",
    });
    return;
  } finally {
    clearTimeout(timeout);
  }

  res.status(upstreamResponse.status);
  upstreamResponse.headers.forEach((value, key) => {
    if (!skippedResponseHeaders.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const sessionId = upstreamResponse.headers.get("mcp-session-id");
  if (sessionId) res.setHeader("mcp-session-id", sessionId);

  if (!upstreamResponse.body) {
    res.end();
    return;
  }

  const responseStream = Readable.fromWeb(
    upstreamResponse.body as unknown as ReadableStream,
  );
  responseStream.once("error", (error) => {
    if (!res.headersSent) {
      res.status(502).json({
        error: "upstream_stream_error",
        error_description: "Upstream MCP response stream failed.",
      });
      return;
    }
    res.destroy(error);
  });
  responseStream.pipe(res);
}

function hasBody(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}
