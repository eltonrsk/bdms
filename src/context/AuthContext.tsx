import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile, UserRole } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  isEmailUnconfirmed: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, role?: UserRole) => Promise<{ error: Error | null; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ACCOUNTS: Record<string, { password: string; role: UserRole; hospital_id: string | null; donor_id: string | null }> = {
  'admin@bloodbank.org': {
    password: 'AdminStrongPass2026!',
    role: 'admin',
    hospital_id: null,
    donor_id: null,
  },
  'hospital@bloodbank.org': {
    password: 'HospitalStrongPass2026!',
    role: 'hospital',
    hospital_id: 'a1111111-1111-1111-1111-111111111111',
    donor_id: null,
  },
  'donor@bloodbank.org': {
    password: 'DonorStrongPass2026!',
    role: 'donor',
    hospital_id: null,
    donor_id: 'e5555555-5555-5555-5555-555555555555',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const finishInitialization = () => {
      if (isMounted) {
        setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          finishInitialization();
        }
      } catch (error) {
        console.error('Error initializing auth session:', error);
        if (isMounted) {
          setProfile(null);
          setSession(null);
          setUser(null);
          finishInitialization();
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setIsEmailUnconfirmed(false);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          finishInitialization();
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string, retry = 0): Promise<void> {
    try {
      const profileRequest = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data: profileData, error } = await Promise.race([
        profileRequest.then((result) => result),
        new Promise<{ data: null; error: Error }>((_, reject) => {
          setTimeout(() => reject(new Error('Profile lookup timed out')), 5000);
        }),
      ]);

      if (error) {
        console.error('Error fetching profile:', error);
      }

      if (!profileData && retry < 2) {
        await new Promise((r) => setTimeout(r, 300));
        return fetchProfile(userId, retry + 1);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setProfile(null);
        return;
      }

      const user = userData.user;
      const metadataRole = (user.app_metadata?.role || user.user_metadata?.role) as UserRole | undefined;
      const normalizedEmail = user.email?.trim().toLowerCase() || '';
      const expectedRole: UserRole =
        metadataRole ||
        (normalizedEmail === 'admin@bloodbank.org'
          ? 'admin'
          : normalizedEmail === 'hospital@bloodbank.org'
          ? 'hospital'
          : 'donor');
      const expectedHospitalId = normalizedEmail === 'hospital@bloodbank.org' ? 'a1111111-1111-1111-1111-111111111111' : null;
      const expectedDonorId = expectedRole === 'donor' ? user.id : null;

      if (!profileData) {
        const fallbackProfile = {
          id: user.id,
          role: expectedRole,
          hospital_id: expectedHospitalId,
          donor_id: expectedDonorId,
          created_at: new Date().toISOString(),
        };

        if (expectedRole === 'donor' && typeof window !== 'undefined') {
          const pendingData = window.localStorage.getItem('pending_signup_data');
          if (pendingData) {
            try {
              const parsed = JSON.parse(pendingData) as {
                full_name: string;
                phone: string;
                blood_type: string;
                date_of_birth: string;
                gender?: string;
                district?: string;
                address?: string;
                city?: string;
                state?: string;
                postal_code?: string;
              };

              const [first_name, ...remaining] = parsed.full_name.trim().split(/\s+/);
              const last_name = remaining.join(' ');

              const { error: donorError } = await supabase.from('donors').insert({
                id: user.id,
                first_name,
                last_name,
                email: user.email || '',
                phone: parsed.phone,
                blood_type: parsed.blood_type,
                rh_factor: parsed.blood_type.includes('+') ? '+' : '-',
                date_of_birth: parsed.date_of_birth,
                gender: parsed.gender || null,
                district: parsed.district || '',
                address: parsed.address || '',
                city: parsed.city || '',
                state: parsed.state || '',
                postal_code: parsed.postal_code || '',
              });

              if (donorError) {
                console.error('Error creating donor profile from pending signup data:', donorError);
              } else {
                window.localStorage.removeItem('pending_signup_data');
              }
            } catch (e) {
              console.error('Unable to parse pending signup data:', e);
            }
          }
        }

        const { error: insertError } = await supabase.from('user_profiles').insert(fallbackProfile);
        if (insertError) {
          console.error('Error creating fallback user profile:', insertError);
        }

        setProfile(fallbackProfile);
        return;
      }

      if (
        profileData.role !== expectedRole ||
        profileData.hospital_id !== expectedHospitalId ||
        profileData.donor_id !== expectedDonorId
      ) {
        const updateProfile = {
          role: expectedRole,
          hospital_id: expectedHospitalId,
          donor_id: expectedDonorId,
        };

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(updateProfile)
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating user profile role/hospital assignment:', updateError);
        } else {
          profileData.role = expectedRole;
          profileData.hospital_id = expectedHospitalId;
          profileData.donor_id = expectedDonorId;
        }
      }

      setProfile(profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const demoAccount = DEMO_ACCOUNTS[normalizedEmail];

    if (demoAccount && password === demoAccount.password) {
      const demoUser = {
        id: normalizedEmail === 'admin@bloodbank.org'
          ? 'demo-admin-user'
          : normalizedEmail === 'hospital@bloodbank.org'
          ? 'demo-hospital-user'
          : 'demo-donor-user',
        email: normalizedEmail,
        app_metadata: { role: demoAccount.role },
        user_metadata: { role: demoAccount.role },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User;

      const demoSession = {
        access_token: 'demo-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'demo-refresh-token',
        user: demoUser,
      } as Session;

      setSession(demoSession);
      setUser(demoUser);
      setProfile({
        id: demoUser.id,
        role: demoAccount.role,
        hospital_id: demoAccount.hospital_id,
        donor_id: demoAccount.donor_id,
        created_at: new Date().toISOString(),
      } as UserProfile);
      setLoading(false);
      setIsEmailUnconfirmed(false);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data.user) {
      setLoading(true);
      await fetchProfile(data.user.id);
    }

    return { error: null };
  }

  async function signUp(email: string, password: string, defaultRole: UserRole = 'donor') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: defaultRole }
      }
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data.user && !data.session) {
      setIsEmailUnconfirmed(true);
      return { error: null, needsConfirmation: true };
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    setLoading(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        role: profile?.role ?? null,
        isEmailUnconfirmed,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
