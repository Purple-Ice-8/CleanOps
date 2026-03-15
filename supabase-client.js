// Supabase Configuration
const SUPABASE_URL = 'https://qnhcknmfiduhlmuoegeu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuaGNrbm1maWR1aGxtdW9lZ2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTc5NzAsImV4cCI6MjA4ODY5Mzk3MH0.7yDthPZ8_ukbGKZbqmhqFWQz3PsZZX98u21bJXQ6pZA';

// Initialize the Supabase client
// Note: We expect the Supabase CDN script to be loaded in the HTML
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make available globally
window.supabase = supabase;
