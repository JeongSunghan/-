import Dashboard from "@/components/dashboard";
import { alertSubscriptions, providers, reports } from "@/lib/mock-data";

export default function HomePage() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <Dashboard
      initialProviders={providers}
      initialReports={reports}
      initialSubscriptions={alertSubscriptions}
      hasSupabaseEnv={hasSupabaseEnv}
    />
  );
}
