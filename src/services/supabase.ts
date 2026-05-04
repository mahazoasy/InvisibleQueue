import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types pour les tables
export type Queue = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_by: string;
  created_at: string;
};

export type QueueEntry = {
  id: string;
  queue_id: string;
  user_id: string | null;
  session_id: string | null;
  display_name: string;
  email: string;
  status: 'waiting' | 'served' | 'missed' | 'left' | 'excluded';
  missed_count: number;
  queue_order: number;
  created_at: string;
  updated_at: string;
};