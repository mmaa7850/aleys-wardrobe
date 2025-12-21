import { supabase } from "@/lib/supabase";

const schema = import.meta.env.VITE_DB_SCHEMA || "public";

if (import.meta.env.DEV) {
  console.log("[db] VITE_DB_SCHEMA =", import.meta.env.VITE_DB_SCHEMA);
  console.log("[db] using schema =", schema);
}

export const db = supabase.schema(schema);