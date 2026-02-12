import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    loadUser();
    loadLowStockCount();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.log('User not logged in');
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

  const operatorNavItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: Home },
    { name: 'Scan', page: 'Scan', icon: ScanBarcode },
    { name: 'Progress', page: 'MyWIP', icon: ClipboardList },
  ];

  const adminNavItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: Home },
    { name: 'Scan', page: 'Scan', icon: ScanBarcode },
    { name: 'Progress', page: 'MyWIP', icon: ClipboardList },
    { name: 'Projects', page: 'Projects', icon: FolderOpen },
    { name: 'Parts', page: 'Parts', icon: Package },
    { name: 'Operations', page: 'Operations', icon: Settings },
    { name: 'Reports', page: 'Reports', icon: BarChart3 },
  ];

  const navItems = isAdmin ? adminNavItems : operatorNavItems;

  const handleLogout = () => {
    base44.auth.logout();
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Progress Better</h1>
            <p className="text-xs text-slate-400">Manufacturing Tracker</p>
          </div>
        </div>
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
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
              {item.page === 'Dashboard' && lowStockCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {lowStockCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
              <Badge variant="outline" className={`mt-1 text-xs ${isAdmin ? 'border-amber-500 text-amber-400' : 'border-slate-500 text-slate-400'}`}>
                {isAdmin ? 'Manager' : 'Operator'}
              </Badge>
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
    <div className="min-h-screen bg-slate-100">
      <style>{`
        :root {
          --primary: 217 91% 60%;
          --primary-foreground: 0 0% 100%;
        }
      `}</style>
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 shadow-lg">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">Progress Better</span>
          </div>
          
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <Link to={createPageUrl('Dashboard')}>
                <Badge variant="destructive" className="flex items-center gap-1">
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
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-72 bg-slate-900 flex-col z-50">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-pb">
        <div className="flex justify-around items-center h-16">
          {operatorNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex flex-col items-center justify-center py-2 px-4 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                <item.icon className={`w-6 h-6 ${item.page === 'Scan' ? 'w-7 h-7' : ''}`} />
                <span className="text-xs mt-1 font-medium">{item.name}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to={createPageUrl('Parts')}
              className={`flex flex-col items-center justify-center py-2 px-4 ${
                currentPageName === 'Parts' ? 'text-blue-600' : 'text-slate-400'
              }`}
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