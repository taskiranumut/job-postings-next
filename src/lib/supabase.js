import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase credentials not found in environment variables');
}

// Backend tarafında Service Role Key kullanıyoruz.
// Bu key, RLS (Row Level Security) politikalarını bypass edebilir.
// Bu yüzden bu client'ı ASLA frontend'e sızdırmayın.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false, // Server-side olduğu için session tutmaya gerek yok
  },
});

