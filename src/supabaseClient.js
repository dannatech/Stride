import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Stride] Supabase env vars NOT found — using placeholder.supabase.co (auth calls will fail with ERR_NAME_NOT_RESOLVED). " +
      "Create .env at the repo root with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, then restart `npm run dev`."
  );
} else {
  console.log(`[Stride] Supabase configured: ${supabaseUrl}`);
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");
