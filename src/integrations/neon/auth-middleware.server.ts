import { createRemoteJWKSet, jwtVerify } from "jose";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { NEON_AUTH_JWKS_URL } from "./auth-config";
import { getNeonDb, type NeonDbClient } from "./supabase-compat.server";
import { createTenantDb, resolveTenantScope, type TenantScope } from "./tenant-db.server";

const JWKS = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));

export type AuthClaims = {
  sub?: string;
  email?: string;
  [key: string]: unknown;
};

async function verifyBearerToken(token: string): Promise<{ userId: string; claims: AuthClaims }> {
  const { payload } = await jwtVerify(token, JWKS);
  const userId = payload.sub;
  if (!userId) throw new Error("Unauthorized: No user ID in token");
  return {
    userId,
    claims: payload as AuthClaims,
  };
}

/** Neon Auth JWT + Neon DB 컨텍스트 (기존 requireSupabaseAuth 대체) */
export const requireNeonAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No authorization header provided");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new Error("Unauthorized: No token provided");

  const { userId, claims } = await verifyBearerToken(token);
  const adminDb = getNeonDb();
  let tenantScope: TenantScope;
  try {
    tenantScope = await resolveTenantScope(adminDb, userId);
  } catch {
    tenantScope = { userId, storeCode: "", isAdmin: false };
  }
  const db = tenantScope.storeCode ? createTenantDb(tenantScope) : adminDb;

  return next({
    context: {
      supabase: db,
      db,
      userId,
      claims,
      tenantScope,
    },
  });
});

/** @deprecated alias */
export const requireSupabaseAuth = requireNeonAuth;

export type NeonAuthContext = {
  supabase: NeonDbClient;
  db: NeonDbClient;
  userId: string;
  claims: AuthClaims;
  tenantScope?: TenantScope;
};
