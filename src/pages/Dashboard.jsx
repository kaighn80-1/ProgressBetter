import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  AlertTriangle, 
  Activity, 
  ScanBarcode,
  ArrowRight,
  Clock,
  TrendingUp,
  Box,
  UserPlus,
  Users,
  ShieldCheck,
  ClipboardCheck,
  ClipboardList,
  Wrench,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [parts, setParts] = useState([]);
  const [fixings, setFixings] = useState([]);
  const [wips, setWips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [promoting, setPromoting] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, partsData, fixingsData, wipsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Part.list(),
        base44.entities.Fixing.list(),
        base44.entities.WorkInProgress.filter({ status: 'active' })
      ]);
      setUser(userData);
      setParts(partsData);
      setFixings(fixingsData);
      setWips(wipsData);
      
      // Load all users if admin
      if (userData?.role === 'admin') {
        const usersData = await base44.entities.User.list();
        setAllUsers(usersData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canManageTeam = isAdmin; // Only full managers can invite/manage users
  const myWips = wips.filter(w => w.worker_email === user?.email);
  const lowStockParts = parts.filter(p => p.min_stock_level && (p.finished_stock || 0) < p.min_stock_level);
  const lowStockFixings = fixings.filter(f => f.min_stock_level && (f.current_stock || 0) < f.min_stock_level);
  const totalStock = parts.reduce((sum, p) => sum + (p.finished_stock || 0), 0);
  const totalWipQuantity = wips.reduce((sum, w) => sum + (w.quantity || 0), 0);

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('user');
    } catch (e) {
      toast.error('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handlePromoteUser = async (userToPromote) => {
    setPromoting(userToPromote.id);
    try {
      await base44.entities.User.update(userToPromote.id, { role: 'admin' });
      toast.success(`${userToPromote.full_name || userToPromote.email} promoted to Manager`);
      const usersData = await base44.entities.User.list();
      setAllUsers(usersData);
    } catch (e) {
      toast.error('Failed to promote user');
    } finally {
      setPromoting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Welcome Header */}
      <div className="rounded-2xl p-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Welcome, {user?.full_name?.split(' ')[0] || 'Operator'}
            </h1>
            <p className="text-sm" style={{ color: '#DBEAFE' }}>
              {isAdmin ? 'Manager Dashboard' : isSupervisor ? 'Supervisor Dashboard' : 'Operator Dashboard'}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            disabled={loading}
            className="text-white hover:bg-white/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        <Link to={createPageUrl('Scan')}>
          <Button size="lg" className="w-full shadow-lg hover:opacity-90" style={{ backgroundColor: '#FFFFFF', color: '#3B82F6' }}>
            <ScanBarcode className="w-5 h-5 mr-2" />
            Scan Barcode
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <Activity className="w-6 h-6" style={{ color: '#3B82F6' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>{(isAdmin || isSupervisor) ? wips.length : myWips.length}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{(isAdmin || isSupervisor) ? 'All Active WIP' : 'My Active WIP'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to={createPageUrl('Reports')} className={lowStockParts.length + lowStockFixings.length > 0 ? '' : 'pointer-events-none'}>
          <Card className={`border-0 shadow-md hover:shadow-lg transition-all`} 
            style={(lowStockParts.length + lowStockFixings.length) > 0 ? { 
              backgroundColor: '#FEF3C7', 
              border: '2px solid #F59E0B' 
            } : { backgroundColor: '#F8FAFC' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center`}
                  style={(lowStockParts.length + lowStockFixings.length) > 0 ? { backgroundColor: '#FED7AA' } : { backgroundColor: '#F1F5F9' }}>
                  <AlertTriangle className={`w-6 h-6 ${(lowStockParts.length + lowStockFixings.length) > 0 ? 'animate-pulse' : ''}`}
                    style={{ color: (lowStockParts.length + lowStockFixings.length) > 0 ? '#F59E0B' : '#CBD5E1' }} />
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Low Stock Alerts</p>
                  <p className={`text-2xl font-bold`}
                    style={{ color: (lowStockParts.length + lowStockFixings.length) > 0 ? '#F59E0B' : '#CBD5E1' }}>
                    {lowStockParts.length + lowStockFixings.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Manager Stats */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                  <Box className="w-6 h-6" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>{totalStock.toLocaleString()}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>Total Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E0E7FF' }}>
                  <TrendingUp className="w-6 h-6" style={{ color: '#3B82F6' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>{totalWipQuantity.toLocaleString()}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>Units in WIP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low Stock Alerts */}
      {(lowStockParts.length > 0 || lowStockFixings.length > 0) && (
        <Card className="border-0 shadow-md border-l-4" style={{ borderLeftColor: '#F59E0B' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: '#F59E0B' }}>
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockParts.slice(0, 3).map((part) => (
              <div key={part.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5" style={{ color: '#F59E0B' }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: '#1E293B' }}>{part.part_name}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{part.part_number}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: '#F59E0B' }}>{part.finished_stock || 0}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>Min: {part.min_stock_level}</p>
                </div>
              </div>
            ))}
            {lowStockFixings.slice(0, 2).map((fixing) => (
              <div key={fixing.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <Wrench className="w-5 h-5" style={{ color: '#F59E0B' }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: '#1E293B' }}>{fixing.fixing_name}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{fixing.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: '#F59E0B' }}>{fixing.current_stock || 0}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>Min: {fixing.min_stock_level}</p>
                </div>
              </div>
            ))}
            {(lowStockParts.length + lowStockFixings.length) > 5 && (
              <Link to={createPageUrl('Reports')}>
                <Button variant="ghost" className="w-full" style={{ color: '#F59E0B' }}>
                  View all {lowStockParts.length + lowStockFixings.length} alerts
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Active WIP */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: '#3B82F6' }} />
              {(isAdmin || isSupervisor) ? 'All Active WIP' : 'My Active WIP'}
            </CardTitle>
            <Link to={createPageUrl('MyWIP')}>
              <Button variant="ghost" size="sm" style={{ color: '#3B82F6' }}>
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {((isAdmin || isSupervisor) ? wips : myWips).length === 0 ? (
            <div className="text-center py-8" style={{ color: '#64748B' }}>
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active work in progress</p>
              <Link to={createPageUrl('Scan')}>
                <Button variant="link" className="mt-2">
                  Start by scanning a part
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {((isAdmin || isSupervisor) ? wips : myWips).slice(0, 5).map((wip) => (
                <Link key={wip.id} to={createPageUrl(`MyWIP?wip=${wip.id}`)}>
                  <div className="flex items-center justify-between p-3 rounded-xl transition-colors" style={{ backgroundColor: '#F8FAFC' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                        <Package className="w-5 h-5" style={{ color: '#3B82F6' }} />
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: '#1E293B' }}>{wip.part_name}</p>
                        <p className="text-xs" style={{ color: '#64748B' }}>{wip.operation_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                        {wip.quantity} {wip.unit || 'pcs'}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Take Actions */}
      <Link to={createPageUrl('PartialStockTake')}>
        <Card className="border-0 shadow-md hover:shadow-xl transition-all border-2" 
          style={{ 
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            borderColor: '#93C5FD'
          }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: '#3B82F6' }}>
                  <ClipboardCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-base" style={{ color: '#1E40AF' }}>Start Partial Stock Take</p>
                  <p className="text-sm" style={{ color: '#2563EB' }}>Quick cycle counting for accuracy</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5" style={{ color: '#3B82F6' }} />
            </div>
          </CardContent>
        </Card>
      </Link>

      {isAdmin && (
        <Link to={createPageUrl('FullStockTake')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Full Stock Count</p>
                  <p className="text-xs text-slate-500">Complete inventory check</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Quick Actions for Admin */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-4">
          <Link to={createPageUrl('Parts')}>
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Manage Parts</p>
                  <p className="text-xs text-slate-500">{parts.length} parts</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('Reports')}>
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">View Reports</p>
                  <p className="text-xs text-slate-500">Stock & History</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Team Management - Admin Only */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-4">
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Invite User</p>
                    <p className="text-xs text-slate-500">Add team members</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Operator</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Operators: basic functions. Supervisors: + priorities, delivery notes, stock reports. Managers: full access.
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleInviteUser}
                  disabled={inviting}
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
            <DialogTrigger asChild>
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Team Members</p>
                    <p className="text-xs text-slate-500">{allUsers.length} users</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Team Members</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-4 max-h-96 overflow-y-auto">
                {allUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-600">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {u.full_name || 'No name'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 
                        u.role === 'supervisor' ? 'bg-orange-100 text-orange-700' : 
                        'bg-slate-100 text-slate-600'
                      }>
                        {u.role === 'admin' ? 'Manager' : u.role === 'supervisor' ? 'Supervisor' : 'Operator'}
                      </Badge>
                      {u.role !== 'admin' && u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePromoteUser(u)}
                          disabled={promoting === u.id}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {allUsers.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No users found</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}