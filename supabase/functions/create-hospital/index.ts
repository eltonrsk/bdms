import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    Vary: "Origin",
  };
};

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("DB_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing DB_URL or SERVICE_KEY');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing DB_URL or SERVICE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => null);
    if (!body || !body.hospital || !body.email) {
      return new Response(JSON.stringify({ error: 'Missing required fields (hospital, email)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hospitalData = body.hospital;
    
    // Validate required hospital fields
    const requiredFields = ['name', 'address', 'city', 'state', 'postal_code', 'phone', 'email', 'contact_person'];
    const missingFields = requiredFields.filter(field => !hospitalData[field]);
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required hospital fields: ${missingFields.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Creating hospital with data:', JSON.stringify(hospitalData));
    
    // generate a password if none provided
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
      const arr = new Uint32Array(16);
      crypto.getRandomValues(arr);
      let p = '';
      for (let i = 0; i < arr.length; i++) p += chars[arr[i] % chars.length];
      return p;
    };
    const userPassword = body.password ?? generatePassword();
    
    // insert hospital first to get id
    console.log('Inserting hospital...');
    const { data: hospitalCreated, error: hospitalError } = await supabase.from('hospitals').insert(hospitalData).select().maybeSingle();

    if (hospitalError) {
      console.error('Hospital insert error:', hospitalError);
      return new Response(JSON.stringify({ error: `Hospital insert failed: ${hospitalError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!hospitalCreated) {
      console.error('No hospital created');
      return new Response(JSON.stringify({ error: 'Hospital insert returned no data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // create auth user for hospital
    console.log('Creating auth user for:', body.email);
    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { role: 'hospital' },
    });

    if (createError) {
      console.error('Auth user creation error:', createError);
      // rollback hospital entry
      await supabase.from('hospitals').delete().eq('id', hospitalCreated.id);
      return new Response(JSON.stringify({ error: `Auth user creation failed: ${createError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!createdUser?.user) {
      console.error('Auth user creation returned no user');
      // rollback hospital entry
      await supabase.from('hospitals').delete().eq('id', hospitalCreated.id);
      return new Response(JSON.stringify({ error: 'Auth user creation returned no data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // create user profile linking to hospital
    console.log('Creating user profile for hospital user:', createdUser.user.id);
    const { error: upsertError } = await supabase.from('user_profiles').upsert({
      id: createdUser.user.id,
      role: 'hospital',
      hospital_id: hospitalCreated.id,
      donor_id: null,
      created_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error('Profile upsert error:', upsertError);
      return new Response(JSON.stringify({ error: `Profile creation failed: ${upsertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Hospital created successfully with ID:', hospitalCreated.id);

    return new Response(JSON.stringify({ hospital: hospitalCreated, user_id: createdUser.user.id }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
