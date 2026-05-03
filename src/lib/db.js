import { supabase } from "@/lib/supabase";

const schema = import.meta.env.VITE_DB_SCHEMA || "public";

export const db = supabase.schema(schema);