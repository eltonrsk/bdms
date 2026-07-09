import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, BLOOD_TYPES } from '../lib/supabase';
import { Droplets, Mail, Lock, User, Phone, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

interface SignUpProps {
  onSwitchToSignIn: () => void;
}

export function SignUp({ onSwitchToSignIn }: SignUpProps) {
  const { signUp, isEmailUnconfirmed } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    blood_type: '',
    date_of_birth: '',
    gender: '',
    district: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        setError('Please fill in all fields');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      setError(null);
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.full_name.trim() || !formData.phone || !formData.blood_type || !formData.date_of_birth || !formData.district) {
      setError('Please fill in all required fields');
      return;
    }

    const pendingSignupData = {
      email: formData.email,
      full_name: formData.full_name,
      phone: formData.phone,
      blood_type: formData.blood_type,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      district: formData.district,
    };

    setLoading(true);

    const result = await signUp(formData.email, formData.password, 'donor');

    if (result.error) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('pending_signup_data');
      }
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pending_signup_data', JSON.stringify(pendingSignupData));
    }

    if (!result.needsConfirmation) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user) {
        const [first_name, ...remaining] = formData.full_name.trim().split(/\s+/);
        const last_name = remaining.join(' ');

        const { error: donorError } = await supabase.from('donors').insert({
          id: user.id,
          first_name,
          last_name,
          email: formData.email,
          phone: formData.phone,
          blood_type: formData.blood_type,
          rh_factor: formData.blood_type.includes('+') ? '+' : '-',
          date_of_birth: formData.date_of_birth,
          gender: formData.gender || null,
          district: formData.district,
        });

        if (donorError) {
          console.error('Error creating donor profile:', donorError);
        } else {
          const { error: profileError } = await supabase.from('user_profiles').insert({
            id: user.id,
            role: 'donor',
            donor_id: user.id,
          });

          if (profileError) {
            console.error('Error creating user profile:', profileError);
          } else {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('pending_signup_data');
            }
          }
        }
      }

      setLoading(false);
      return;
    }

    setLoading(false);
  };

  if (isEmailUnconfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h2>
            <p className="text-slate-600 mb-6">
              We've sent a confirmation link to <strong>{formData.email}</strong>.
              Please click the link to activate your account.
            </p>
            <button
              onClick={onSwitchToSignIn}
              className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              <Droplets className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Create Donor Account</h1>
              <p className="text-slate-500 text-sm mt-1">Step {step} of 2</p>
            </div>

          <div className="flex gap-2 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= step ? 'bg-red-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      placeholder="Min. 6 characters"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Blood Type</label>
                    <select
                      name="blood_type"
                      value={formData.blood_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                      required
                    >
                      <option value="">Select</option>
                      {BLOOD_TYPES.map(bt => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender (Optional)</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                    >
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">District of Origin</label>
                    <select
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                      required
                    >
                      <option value="">Select your district</option>
                      <option value="Arusha Urban">Arusha Urban</option>
                      <option value="Arusha Rural">Arusha Rural</option>
                      <option value="Meru">Meru</option>
                      <option value="Karatu">Karatu</option>
                      <option value="Longido">Longido</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-rose-700 transition-all"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-rose-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <button
                onClick={onSwitchToSignIn}
                className="text-red-600 font-semibold hover:text-red-700 transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
