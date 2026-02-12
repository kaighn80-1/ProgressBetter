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
  UserPlus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [parts, setParts] = useState([]);
  const [wips, setWips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, partsData, wipsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Part.list(),
        base44.entities.WorkInProgress.filter({ status: 'active' })
      ]);
      setUser(userData);
      setParts(partsData);
      setWips(wipsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const myWips = wips.filter(w => w.worker_email === user?.email);
  const lowStockParts = parts.filter(p => p.min_stock_level && (p.finished_stock || 0) < p.min_stock_level);
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
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl">
        <h1 className="text-2xl font-bold mb-1">
          Welcome, {user?.full_name?.split(' ')[0] || 'Operator'}
        </h1>
        <p className="text-blue-100 text-sm mb-4">
          {isAdmin ? 'Manager Dashboard' : 'Operator Dashboard'}
        </p>
        
        <Link to={createPageUrl('Scan')}>
          <Button size="lg" className="w-full bg-white text-blue-600 hover:bg-blue-50 shadow-lg">
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
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{isAdmin ? wips.length : myWips.length}</p>
                <p className="text-xs text-slate-500">{isAdmin ? 'All Active WIP' : 'My Active WIP'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-md ${lowStockParts.length > 0 ? 'bg-red-50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                lowStockParts.length > 0 ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  lowStockParts.length > 0 ? 'text-red-600' : 'text-amber-600'
                }`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lowStockParts.length}</p>
                <p className="text-xs text-slate-500">Low Stock Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manager Stats */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Box className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalStock.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Total Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalWipQuantity.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Units in WIP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockParts.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockParts.slice(0, 5).map((part) => (
              <div key={part.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{part.part_name}</p>
                    <p className="text-xs text-slate-500">{part.part_number}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">{part.finished_stock || 0}</p>
                  <p className="text-xs text-slate-500">Min: {part.min_stock_level}</p>
                </div>
              </div>
            ))}
            {lowStockParts.length > 5 && (
              <Link to={createPageUrl('Reports')}>
                <Button variant="ghost" className="w-full text-red-600">
                  View all {lowStockParts.length} alerts
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
              <Clock className="w-5 h-5 text-blue-600" />
              {isAdmin ? 'All Active WIP' : 'My Active WIP'}
            </CardTitle>
            <Link to={createPageUrl('MyWIP')}>
              <Button variant="ghost" size="sm" className="text-blue-600">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {(isAdmin ? wips : myWips).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
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
              {(isAdmin ? wips : myWips).slice(0, 5).map((wip) => (
                <Link key={wip.id} to={createPageUrl(`MyWIP?wip=${wip.id}`)}>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{wip.part_name}</p>
                        <p className="text-xs text-slate-500">{wip.operation_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
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

      {/* Invite User - Admin Only */}
      {isAdmin && (
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
                    <SelectItem value="admin">Manager</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Operators can scan and manage WIP. Managers have full access.
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
      )}
    </div>
  );
}