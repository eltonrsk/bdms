import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DemoUser {
  email: string;
  password: string;
  role: "admin" | "hospital" | "donor";
  donorId?: string;
  hospitalId?: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@bloodbank.org",
    password: "AdminStrongPass2026!",
    role: "admin",
  },
  {
    email: "hospital@bloodbank.org",
    password: "HospitalStrongPass2026!",
    role: "hospital",
    hospitalId: "a1111111-1111-1111-1111-111111111111",
  },
  {
    email: "donor@bloodbank.org",
    password: "DonorStrongPass2026!",
    role: "donor",
    donorId: "e5555555-5555-5555-5555-555555555555",
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: Array<{ email: string; status: string; error?: string }> = [];

    for (const user of DEMO_USERS) {
      // Check if user already exists
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u) => u.email === user.email);

      if (found) {
        // Update password to ensure it works
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          found.id,
          { password: user.password, email_confirm: true }
        );
        results.push({
          email: user.email,
          status: updateError ? "update_failed" : "updated",
          error: updateError?.message,
        });

        // Ensure profile has correct role + links
        await supabase.from("user_profiles").upsert({
          id: found.id,
          role: user.role,
          donor_id: user.donorId ?? null,
          hospital_id: user.hospitalId ?? null,
        });
        continue;
      }

      // Create new user
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { role: user.role },
      });

      if (createError || !created.user) {
        results.push({
          email: user.email,
          status: "create_failed",
          error: createError?.message,
        });
        continue;
      }

      // Create profile with correct role + links
      await supabase.from("user_profiles").upsert({
        id: created.user.id,
        role: user.role,
        donor_id: user.donorId ?? null,
        hospital_id: user.hospitalId ?? null,
      });

      results.push({ email: user.email, status: "created" });
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
