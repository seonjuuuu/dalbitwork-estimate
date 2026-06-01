import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { ENV } from "./env";

export const supabaseAdmin = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});
