import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { verifyAccessToken } from "./jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    bridgeAuth?: {
      subject: string;
      scope: string;
    };
  }
}

export function requireBridgeAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.header("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    sendAuthChallenge(res);
    return;
  }

  try {
    const claims = verifyAccessToken(token);
    req.bridgeAuth = {
      subject: claims.sub,
      scope: claims.scope,
    };
    next();
  } catch {
    sendAuthChallenge(res);
  }
}

function sendAuthChallenge(res: Response) {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${config.publicMcpResource}/.well-known/oauth-protected-resource", scope="${config.oauthScopes.join(" ")}"`,
  );
  res.status(401).json({
    error: "unauthorized",
    error_description: "A valid bridge OAuth bearer token is required.",
  });
}
