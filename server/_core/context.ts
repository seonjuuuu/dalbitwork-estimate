import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { supabaseAdmin } from "./supabase";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const authHeader = opts.req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token) {
      const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

      if (!error && supabaseUser) {
        const meta = supabaseUser.user_metadata ?? {};
        const name = meta.full_name ?? meta.name ?? meta.user_name ?? null;
        await db.upsertUser({
          openId: supabaseUser.id,
          email: supabaseUser.email ?? null,
          name,
          loginMethod: supabaseUser.app_metadata?.provider ?? null,
          lastSignedIn: new Date(),
        });
        const dbUser = await db.getUserByOpenId(supabaseUser.id);
        user = dbUser ?? null;
      }
    }
  } catch (error) {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
