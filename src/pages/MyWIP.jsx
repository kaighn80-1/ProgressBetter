import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Package, 
  Clock, 
  ArrowRight, 
  Check, 
  Trash2, 
  Loader2,
  Activity,
  User,
  ChevronRight
} from 'lucide-react';

export default function MyWIP() {
  const [user, setUser] = useState(null);
  const [wips, setWips] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWip, setSelectedWip] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showScrapDialog, setShowScrapDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('my');
  
  const [moveForm, setMoveForm] = useState({ operation_id: '', notes: '' });
  const [completeForm, setCompleteForm] = useState({ notes: '' });
  const [scrapForm, setScrapForm] = useState({ reason: '' });

  useEffect(() => {
    loadData();
    
    // Check for WIP param in URL
    const params = new URLSearchParams(window.location.search);
    const wipId = params.get('wip');
    if (wipId) {
      loadWipDetail(wipId);
    }
  }, []);

  const loadData = async () => {
    try {
      const [userData, wipsData, ops] = await Promise.all([
        base44.auth.me(),
        base44.entities.WorkInProgress.filter({ status: 'active' }, '-started_date'),
        base44.entities.Operation.list('sequence_number')
      ]);
      setUser(userData);
      setWips(wipsData);
      setOperations(ops);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadWipDetail = async (wipId) => {
    try {
      const wip = await base44.entities.WorkInProgress.filter({ id: wipId });
      if (wip.length > 0) {
        setSelectedWip(wip[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isAdmin = user?.role === 'admin';
  const filteredWips = filter === 'all' ? wips : wips.filter(w => w.worker_email === user?.email);

  const moveToNextOperation = async () => {
    if (!moveForm.operation_id) {
      toast.error('Please select an operation');
      return;
    }

    setSaving(true);
    try {
      const newOperation = operations.find(o => o.id === moveForm.operation_id);
      
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        operation_id: moveForm.operation_id,
        operation_name: newOperation?.operation_name,
        notes: moveForm.notes || selectedWip.notes
      });

      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: 0,
        wip_id: selectedWip.id,
        operation_name: newOperation?.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: `Moved from ${selectedWip.operation_name} to ${newOperation?.operation_name}`
      });

      toast.success('Moved to next operation!');
      setShowMoveDialog(false);
      setMoveForm({ operation_id: '', notes: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to move batch');
    } finally {
      setSaving(false);
    }
  };

  const completeWip = async () => {
    setSaving(true);
    try {
      // Update WIP status
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        status: 'completed'
      });

      // Add back to finished stock
      const parts = await base44.entities.Part.filter({ id: selectedWip.part_id });
      if (parts.length > 0) {
        const newStock = (parts[0].finished_stock || 0) + selectedWip.quantity;
        await base44.entities.Part.update(selectedWip.part_id, {
          finished_stock: newStock
        });
      }

      // Create transaction
      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'completed_wip',
        quantity_change: selectedWip.quantity,
        wip_id: selectedWip.id,
        operation_name: selectedWip.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: completeForm.notes || 'WIP completed and returned to stock'
      });

      toast.success('Batch completed!', { 
        description: `${selectedWip.quantity} units returned to stock` 
      });
      setShowCompleteDialog(false);
      setCompleteForm({ notes: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to complete batch');
    } finally {
      setSaving(false);
    }
  };

  const scrapWip = async () => {
    if (!scrapForm.reason) {
      toast.error('Please provide a reason');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        status: 'scrapped',
        notes: `SCRAPPED: ${scrapForm.reason}`
      });

      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'scrapped',
        quantity_change: -selectedWip.quantity,
        wip_id: selectedWip.id,
        operation_name: selectedWip.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: scrapForm.reason
      });

      toast.success('Batch scrapped');
      setShowScrapDialog(false);
      setScrapForm({ reason: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to scrap batch');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work In Progress</h1>
          <p className="text-sm text-slate-500">Manage your active batches</p>
        </div>
        {isAdmin && (
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="my">My WIP</TabsTrigger>
              <TabsTrigger value="all">All WIP</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* WIP List */}
      {filteredWips.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Activity className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No active batches</h3>
            <p className="text-sm text-slate-500">
              Scan a part barcode to start a new WIP batch
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWips.map((wip) => (
            <Card 
              key={wip.id} 
              className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedWip(wip)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Package className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{wip.part_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {wip.operation_name}
                        </Badge>
                        <Badge variant="outline">
                          {wip.quantity} pcs
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(wip.started_date), 'MMM d, h:mm a')}
                        </span>
                        {filter === 'all' && wip.worker_email !== user?.email && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {wip.worker_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* WIP Detail Dialog */}
      <Dialog open={!!selectedWip && !showMoveDialog && !showCompleteDialog && !showScrapDialog} onOpenChange={() => setSelectedWip(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedWip?.part_name}</DialogTitle>
            <DialogDescription>
              Batch started {selectedWip && format(new Date(selectedWip.started_date), 'MMM d, yyyy h:mm a')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWip && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500">Operation</p>
                  <p className="font-semibold text-slate-900">{selectedWip.operation_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500">Quantity</p>
                  <p className="font-semibold text-slate-900">{selectedWip.quantity} pcs</p>
                </div>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">Worker</p>
                <p className="font-semibold text-slate-900">{selectedWip.worker_name || selectedWip.worker_email}</p>
              </div>

              {selectedWip.notes && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="text-sm text-slate-700">{selectedWip.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 pt-2">
                <Button 
                  onClick={() => setShowMoveDialog(true)}
                  className="h-12 bg-blue-600 hover:bg-blue-700"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Move to Next Operation
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowCompleteDialog(true)}
                  className="h-12 border-green-500 text-green-600 hover:bg-green-50"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Complete & Return to Stock
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowScrapDialog(true)}
                  className="h-12 border-red-500 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Scrap Batch
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move to Next Operation Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Next Operation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Operation</Label>
              <Select 
                value={moveForm.operation_id} 
                onValueChange={(v) => setMoveForm({ ...moveForm, operation_id: v })}
              >
                <SelectTrigger className="h-12 mt-1">
                  <SelectValue placeholder="Select operation..." />
                </SelectTrigger>
                <SelectContent>
                  {operations
                    .filter(op => op.id !== selectedWip?.operation_id)
                    .map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.operation_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={moveForm.notes}
                onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={moveToNextOperation} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Move Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Batch</DialogTitle>
            <DialogDescription>
              This will return {selectedWip?.quantity} units to finished stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any completion notes..."
                value={completeForm.notes}
                onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={completeWip} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scrap Dialog */}
      <Dialog open={showScrapDialog} onOpenChange={setShowScrapDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Scrap Batch</DialogTitle>
            <DialogDescription>
              This will permanently remove {selectedWip?.quantity} units. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reason for Scrapping *</Label>
              <Textarea
                placeholder="Enter reason..."
                value={scrapForm.reason}
                onChange={(e) => setScrapForm({ ...scrapForm, reason: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScrapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={scrapWip} disabled={saving} variant="destructive">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Scrap Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}