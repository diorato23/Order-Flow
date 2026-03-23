import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';

// ── Configuração do Supabase para o Comanda-APP ────────────────────────────────
// Projeto: finanzas-app (wjmrssbofvejpecoqjwi)
// As tabelas do Comanda-APP usam prefixo: comanda_

const SUPABASE_URL = 'https://wjmrssbofvejpecoqjwi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbXJzc2JvZnZlanBlY29xandpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzYzODYsImV4cCI6MjA4NzU1MjM4Nn0.VoR6PmCdhNT_YRQ8pCBmc4IctAmxmESffAvzfxyZUE4';

// Forçamos a inferência manual porque a tipagem gerada pode conflitar com GenericSchema
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Necessário para React Native
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const supabase = _supabase as any as Omit<SupabaseClient<any>, 'from'> & {
  from: (table: string) => any;
};

export default supabase;
