import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SignIn } from './components/SignIn';
import { SignUp } from './components/SignUp';
import { Layout } from './components/Layout';

// Admin Imports
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminInventory } from './components/admin/AdminInventory';
import { AdminHospitals } from './components/admin/AdminHospitals';
import { AdminDonors } from './components/admin/AdminDonors';
import { AdminDonations } from './components/admin/AdminDonations';
import { AdminTransfers } from './components/admin/AdminTransfers';

// Hospital Imports
import { HospitalDashboard } from './components/hospital/HospitalDashboard';
import { HospitalInventory } from './components/hospital/HospitalInventory';
import { HospitalDonationRequests } from './components/hospital/HospitalDonationRequests';
import { HospitalTransfers } from './components/hospital/HospitalTransfers';

// Donor Imports
import { DonorDashboard } from './components/donor/DonorDashboard';
import { DonorHospitals } from './components/donor/DonorHospitals';
import { DonorAppointments } from './components/donor/DonorAppointments';
import { DonorProfile } from './components/donor/DonorProfile';

import { Loader2, Droplets } from 'lucide-react';

function AppContent() {
  const { user, profile, loading, role } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Reset to dashboard whenever the user logs in or switches roles
  useEffect(() => {
    if (user) {
      setActiveTab('dashboard');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Droplets className="w-10 h-10 text-white animate-pulse" />
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
          <p className="text-slate-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth Guard: Show sign-in/up if no user is authenticated
  if (!user || !profile) {
    return authMode === 'signin' ? (
      <SignIn onSwitchToSignUp={() => setAuthMode('signup')} />
    ) : (
      <SignUp onSwitchToSignIn={() => setAuthMode('signin')} />
    );
  }

  const renderContent = () => {
    switch (role) {
      case 'admin':
        return {
          dashboard: <AdminDashboard />,
          inventory: <AdminInventory />,
          hospitals: <AdminHospitals />,
          donors: <AdminDonors />,
          donations: <AdminDonations />,
          transfers: <AdminTransfers />,
        }[activeTab] || <AdminDashboard />;

      case 'hospital':
        return {
          dashboard: <HospitalDashboard />,
          inventory: <HospitalInventory />,
          requests: <HospitalDonationRequests />,
          transfers: <HospitalTransfers />,
        }[activeTab] || <HospitalDashboard />;

      case 'donor':
        return {
          dashboard: <DonorDashboard />,
          hospitals: <DonorHospitals />,
          appointments: <DonorAppointments />,
          profile: <DonorProfile />,
        }[activeTab] || <DonorDashboard />;

      default:
        return <div className="p-6 text-slate-400">Unauthorized Role Access</div>;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}