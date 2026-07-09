import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Droplets,
  LogOut,
  LayoutDashboard,
  Building2,
  Users,
  Package,
  FileText,
  Bell,
  Settings,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, profile, signOut } = useAuth();

  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'hospitals', label: 'Hospitals', icon: Building2 },
    { id: 'donors', label: 'Donors', icon: Users },
    { id: 'donations', label: 'Donation Requests', icon: FileText },
    { id: 'transfers', label: 'Transfers', icon: Bell },
  ];

  const hospitalNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'My Inventory', icon: Package },
    { id: 'requests', label: 'Incoming Requests', icon: FileText },
    { id: 'transfers', label: 'Request Blood', icon: Bell },
  ];

  const donorNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'hospitals', label: 'Find Hospitals', icon: Building2 },
    { id: 'appointments', label: 'My Appointments', icon: FileText },
    { id: 'profile', label: 'My Profile', icon: Settings },
  ];

  const navItems =
    profile?.role === 'admin'
      ? adminNavItems
      : profile?.role === 'hospital'
      ? hospitalNavItems
      : donorNavItems;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-md">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Blood Bank</h1>
              <p className="text-xs text-slate-500 capitalize">{profile?.role} Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{user?.email}</p>
              <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)] sticky top-[73px]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-red-50 text-red-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
