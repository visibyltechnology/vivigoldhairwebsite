// Loosely-typed supabase client for admin dashboard queries that touch
// tables/columns/RPCs added after the bundled types.ts was generated
// (e.g. base_currency, admin_dashboard_stats, admin_order_summary view).
import { supabase as typed } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sb: any = typed;
