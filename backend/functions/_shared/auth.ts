import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** CORS headers required by every function the iOS app calls. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthResult {
  userId: string;
  email?: string;
  supabase: SupabaseClient;
}

/**
 * Verifies the caller's Supabase session (native email/password auth) and
 * returns a client scoped to that user, so RLS still applies to its queries.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) throw new AuthError("Missing Authorization header");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthError("Invalid session");

  return { userId: data.user.id, email: data.user.email ?? undefined, supabase };
}

/** Service-role client. Bypasses RLS — only for writes the user may not do directly. */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Throws unless the user is an active admin or bureau member of the club.
 * Money-moving endpoints must never rely on the client claiming a role.
 */
export async function requireClubBoard(
  admin: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("memberships")
    .select("role")
    .eq("club_id", clubId)
    .eq("member_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data || !["admin", "board"].includes(data.role)) {
    throw new ForbiddenError("Only the club committee can do this");
  }
}

/** Maps an error onto a JSON HTTP response with the right status code. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (err instanceof ForbiddenError) {
    return json({ error: err.message }, 403);
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return json({ error: message }, 500);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
