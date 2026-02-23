import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from './utils';
import { 
  Home, 
  ScanBarcode, 
  Package, 
  Settings, 
  ClipboardList,
  BarChart3,
  Menu,
  X,
  LogOut,
  User,
  AlertTriangle,
  FolderOpen,
  Target,
  Wrench,
  Users,
  TrendingUp,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('manager');
  const [switching, setSwitching] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndRedirect();
    loadLowStockCount();
  }, [location.pathname]);

  const checkAuthAndRedirect = async () => {
    // Skip auth check for Login page only
    const publicPages = ['/Login'];
    if (publicPages.includes(location.pathname)) {
      setAuthChecked(true);
      return;
    }

    // Skip auth check for auth-related pages
    const authPages = ['/PinVerification', '/SetupPin', '/ChangePassword'];
    
    try {
      const userData = await base44.auth.me();
      
      // Force logout on page refresh/reload
      // Check if this is a fresh login or a page refresh
      const loginMarker = sessionStorage.getItem('fresh_login');
      
      if (!loginMarker) {
        // No marker = page was refreshed or reopened → force logout
        console.log('Page refresh detected - logging out');
        sessionStorage.clear();
        base44.auth.logout();
        return;
      }
      
      // Clear the marker so next refresh will logout
      sessionStorage.removeItem('fresh_login');
      setUser(userData);
      setViewMode(userData.view_mode || 'manager');

      // Check if PIN is set up
      if (!userData.pin_code) {
        navigate('/SetupPin');
        return;
      }

      // Check if PIN verified in this session (within last hour)
      if (userData.pin_verified_at) {
        const verifiedAt = new Date(userData.pin_verified_at);
        const hoursSinceVerification = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceVerification > 1) {
          navigate('/PinVerification');
          return;
        }
      } else {
        navigate('/PinVerification');
        return;
      }

      // Check if password change required
      if (userData.must_change_password) {
        navigate('/ChangePassword');
        return;
      }

      // Check if password is older than 30 days
      if (userData.last_password_change) {
        const lastChange = new Date(userData.last_password_change);
        const daysSinceChange = Math.floor((Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceChange > 30 && location.pathname !== '/ChangePassword') {
          // Show reminder but allow continued use
          if (daysSinceChange === 31) { // Only show once
            toast.warning('Your password is over 30 days old. Please consider changing it.', {
              duration: 5000,
              action: {
                label: 'Change Now',
                onClick: () => navigate('/ChangePassword')
              }
            });
          }
        }
      }

      setAuthChecked(true);
    } catch (e) {
      // User not logged in - redirect to Login page
      console.log('User not authenticated - redirecting to login');
      navigate('/Login');
      setAuthChecked(true);
    }
  };

  const loadLowStockCount = async () => {
    try {
      const parts = await base44.entities.Part.list();
      const lowStock = parts.filter(p => 
        p.min_stock_level && (p.finished_stock || 0) < p.min_stock_level
      );
      setLowStockCount(lowStock.length);
    } catch (e) {
      console.log('Could not load parts');
    }
  };

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isOperatorMode = viewMode === 'operator';
  const isSupervisorMode = viewMode === 'supervisor';

  const handleToggleViewMode = async () => {
    if (!isManager && !isSupervisor) return;
    
    setSwitching(true);
    let newMode;
    
    if (isManager) {
      // Manager can cycle through all modes
      if (viewMode === 'manager') newMode = 'supervisor';
      else if (viewMode === 'supervisor') newMode = 'operator';
      else newMode = 'manager';
    } else if (isSupervisor) {
      // Supervisor can toggle between supervisor and operator
      newMode = viewMode === 'supervisor' ? 'operator' : 'supervisor';
    } else {
      return; // Operators can't switch
    }
    
    try {
      await base44.auth.updateMe({ view_mode: newMode });
      setViewMode(newMode);
      const modeNames = { operator: 'Operator', supervisor: 'Supervisor', manager: 'Manager' };
      toast.success(`🔄 Switched to ${modeNames[newMode]} Mode`);
      setSidebarOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to switch mode');
    } finally {
      setSwitching(false);
    }
  };

  const operatorNavItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: Home },
    { name: 'Scan Barcode', page: 'Scan', icon: ScanBarcode },
    { name: 'Progress', page: 'MyWIP', icon: ClipboardList },
    { name: 'Partial Stock Take', page: 'PartialStockTake', icon: AlertTriangle },
  ];

  const supervisorNavItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: Home },
    { name: 'Scan Barcode', page: 'Scan', icon: ScanBarcode },
    { name: 'Progress', page: 'MyWIP', icon: ClipboardList },
    { name: 'Priorities', page: 'Requirements', icon: Target },
    { name: 'Delivery Notes', page: 'DeliveryNotes', icon: TrendingUp },
    { name: 'Stock Report', page: 'FullStockTakeReport', icon: ClipboardList },
    { name: 'Partial Stock Take', page: 'PartialStockTake', icon: AlertTriangle },
    { name: 'Full Stock Take', page: 'FullStockTake', icon: ClipboardList },
  ];

  const adminNavItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: Home },
    { name: 'Scan Barcode', page: 'Scan', icon: ScanBarcode },
    { name: 'Progress', page: 'MyWIP', icon: ClipboardList },
    { name: 'Priorities', page: 'Requirements', icon: Target },
    { name: 'Projects', page: 'Projects', icon: FolderOpen },
    { name: 'Assemblies', page: 'Assemblies', icon: Package },
    { name: 'Parts Management', page: 'Parts', icon: Package },
    { name: 'Fixings', page: 'Fixings', icon: Wrench },
    { name: 'Operations', page: 'Operations', icon: Settings },
    { name: 'Delivery Notes', page: 'DeliveryNotes', icon: TrendingUp },
    { name: 'Reports', page: 'Reports', icon: BarChart3 },
    { name: 'Stock Report', page: 'FullStockTakeReport', icon: ClipboardList },
    { name: 'Partial Stock Take', page: 'PartialStockTake', icon: AlertTriangle },
    { name: 'Full Stock Take', page: 'FullStockTake', icon: ClipboardList },
  ];

  const navItems = 
    (isManager && viewMode === 'manager') ? adminNavItems :
    (isManager && viewMode === 'supervisor') ? supervisorNavItems :
    (isSupervisor && viewMode === 'supervisor') ? supervisorNavItems :
    operatorNavItems;

  const handleLogout = () => {
    base44.auth.logout();
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b" style={{ borderColor: '#475569' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3B82F6' }}>
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Progress Better</h1>
            <p className="text-xs text-slate-400">Manufacturing Tracker</p>
          </div>
        </div>
        
        {/* View Mode Switcher - For Managers and Supervisors */}
        {(isManager || isSupervisor) && (
          <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">View Mode</span>
              <Badge 
                variant="outline" 
                style={{ 
                  backgroundColor: isOperatorMode ? '#DBEAFE' : isSupervisorMode ? '#FED7AA' : '#D1FAE5',
                  color: isOperatorMode ? '#1E40AF' : isSupervisorMode ? '#92400E' : '#065F46',
                  borderColor: 'transparent'
                }}
              >
                {isOperatorMode ? 'Operator' : isSupervisorMode ? 'Supervisor' : 'Manager'}
              </Badge>
            </div>
            <button
              onClick={handleToggleViewMode}
              disabled={switching}
              className="w-full h-10 rounded-lg flex items-center justify-center gap-2 transition-all font-medium"
              style={{ 
                backgroundColor: isOperatorMode ? '#3B82F6' : isSupervisorMode ? '#F59E0B' : '#10B981',
                color: 'white'
              }}
            >
              {switching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {isManager ? (
                    viewMode === 'manager' ? 'Switch to Supervisor' :
                    viewMode === 'supervisor' ? 'Switch to Operator' : 'Back to Manager'
                  ) : (
                    viewMode === 'supervisor' ? 'Switch to Operator' : 'Back to Supervisor'
                  )}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPageName === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'text-white shadow-lg' 
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
              style={isActive ? { backgroundColor: '#3B82F6' } : {}}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
              {item.page === 'Dashboard' && lowStockCount > 0 && (
                <Badge className="ml-auto font-bold" style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}>
                  {lowStockCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="p-4 border-t" style={{ borderColor: '#475569' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className={`text-xs ${
                  isAdmin ? 'border-amber-500 text-amber-400' : 
                  isSupervisor ? 'border-orange-400 text-orange-400' : 
                  'border-slate-500 text-slate-400'
                }`}>
                  {isAdmin ? 'Manager' : isSupervisor ? 'Supervisor' : 'Operator'}
                </Badge>
                {(isManager || isSupervisor) && viewMode !== (isManager ? 'manager' : 'supervisor') && (
                  <Badge variant="outline" className={`text-xs ${
                    isOperatorMode ? 'border-blue-400 text-blue-400' :
                    isSupervisorMode ? 'border-orange-400 text-orange-400' : ''
                  }`}>
                    Viewing as {isOperatorMode ? 'Operator' : 'Supervisor'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-700"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F1F5F9' }}>
      <style>{`
        :root {
          /* Primary - Brand/Focus (Blue) */
          --primary: 217 91% 60%;
          --primary-rgb: 59, 130, 246;
          --primary-hover: 221 83% 53%;
          --primary-foreground: 0 0% 100%;
          
          /* Secondary - Balance/Restore (Green) */
          --secondary: 160 84% 39%;
          --secondary-rgb: 16, 185, 129;
          --secondary-foreground: 0 0% 100%;
          
          /* Accent - Energy/Warning (Amber) */
          --accent: 38 92% 50%;
          --accent-rgb: 245, 158, 11;
          --accent-foreground: 220 13% 13%;
          
          /* Success */
          --success: 160 84% 39%;
          --success-foreground: 0 0% 100%;
          
          /* Warning */
          --warning: 38 92% 50%;
          --warning-foreground: 220 13% 13%;
          
          /* Error/Danger */
          --destructive: 0 84% 60%;
          --destructive-foreground: 0 0% 100%;
          
          /* Neutral Backgrounds */
          --background: 214 32% 96%;
          --surface: 0 0% 100%;
          --card: 0 0% 100%;
          --card-foreground: 220 13% 13%;
          
          /* Borders & Dividers */
          --border: 214 32% 91%;
          --input: 214 32% 91%;
          --ring: 217 91% 60%;
          
          /* Text Colors */
          --foreground: 220 13% 13%;
          --muted-foreground: 215 16% 47%;
          --popover-foreground: 220 13% 13%;
          
          /* Other */
          --muted: 210 40% 96%;
          --popover: 0 0% 100%;
          --radius: 0.75rem;
        }
        
        body {
          background-color: #F1F5F9;
          color: #1E293B;
        }
        
        /* Global Button Styles */
        .btn-primary {
          background-color: #3B82F6;
          color: white;
        }
        .btn-primary:hover {
          background-color: #2563EB;
        }
        
        .btn-secondary {
          background-color: #10B981;
          color: white;
        }
        .btn-secondary:hover {
          background-color: #059669;
        }
        
        .btn-accent {
          background-color: #F59E0B;
          color: #1E293B;
        }
        .btn-accent:hover {
          background-color: #D97706;
        }
        
        /* Card & Surface Styles */
        .card-surface {
          background-color: #FFFFFF;
          border: 1px solid #E2E8F0;
        }
        
        /* Alert Styles */
        .alert-warning {
          background-color: #FEF3C7;
          border-color: #F59E0B;
          color: #92400E;
        }
        
        .alert-success {
          background-color: #D1FAE5;
          border-color: #10B981;
          color: #065F46;
        }
        
        .alert-error {
          background-color: #FEE2E2;
          border-color: #EF4444;
          color: #991B1B;
        }
      `}</style>
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 shadow-lg" style={{ backgroundColor: '#1E293B' }}>
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3B82F6' }}>
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">Progress Better</span>
          </div>
          
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <Link to={createPageUrl('Dashboard')}>
                <Badge className="flex items-center gap-1 font-bold" style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}>
                  <AlertTriangle className="w-3 h-3" />
                  {lowStockCount}
                </Badge>
              </Link>
            )}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-slate-900 border-slate-700">
                <NavContent />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-72 flex-col z-50" style={{ backgroundColor: '#1E293B' }}>
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white z-50 safe-area-pb" style={{ borderTop: '1px solid #E2E8F0' }}>
        <div className="flex justify-around items-center h-16">
          {operatorNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex flex-col items-center justify-center py-2 px-4`}
                style={{ color: isActive ? '#3B82F6' : '#94A3B8' }}
              >
                <item.icon className={`w-6 h-6 ${item.page === 'Scan' ? 'w-7 h-7' : ''}`} />
                <span className="text-xs mt-1 font-medium">{item.name}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to={createPageUrl('Parts')}
              className={`flex flex-col items-center justify-center py-2 px-4`}
              style={{ color: currentPageName === 'Parts' ? '#3B82F6' : '#94A3B8' }}
            >
              <Package className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">Parts</span>
            </Link>
          )}
        </div>
      </nav>

      <Toaster position="top-center" richColors />
    </div>
  );
}