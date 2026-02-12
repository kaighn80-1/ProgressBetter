import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import BarcodeScanner from '@/components/scanner/BarcodeScanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ScanBarcode, 
  Package, 
  AlertTriangle, 
  Plus, 
  ArrowRight,
  X,
  Check,
  Loader2,
  Search,
  Activity
} from 'lucide-react';

export default function Scan() {
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [scannedPart, setScannedPart] = useState(null);
  const [operations, setOperations] = useState([]);
  const [activeWips, setActiveWips] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Action dialogs
  const [showWipDialog, setShowWipDialog] = useState(false);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [wipForm, setWipForm] = useState({ operation_id: '', quantity: '', notes: '' });
  const [addStockForm, setAddStockForm] = useState({ quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [userData, ops] = await Promise.all([
        base44.auth.me(),
        base44.entities.Operation.list('sequence_number')
      ]);
      setUser(userData);
      setOperations(ops);
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async (barcode) => {
    setShowScanner(false);
    setLoading(true);

    try {
      const parts = await base44.entities.Part.filter({ barcode: barcode });
      if (parts.length === 0) {
        toast.error('Part not found', { description: `No part with barcode: ${barcode}` });
        setScannedPart(null);
      } else {
        const part = parts[0];
        setScannedPart(part);
        
        // Load active WIPs for this part
        const wips = await base44.entities.WorkInProgress.filter({ 
          part_id: part.id, 
          status: 'active' 
        });
        setActiveWips(wips);
        
        toast.success('Part found!', { description: part.part_name });
      }
    } catch (e) {
      console.error(e);
      toast.error('Error looking up part');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const parts = await base44.entities.Part.list();
      const filtered = parts.filter(p => 
        p.part_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const selectPart = async (part) => {
    setScannedPart(part);
    setSearchResults([]);
    setSearchQuery('');
    
    const wips = await base44.entities.WorkInProgress.filter({ 
      part_id: part.id, 
      status: 'active' 
    });
    setActiveWips(wips);
  };

  const startNewWip = async () => {
    if (!wipForm.operation_id || !wipForm.quantity || parseInt(wipForm.quantity) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const operation = operations.find(o => o.id === wipForm.operation_id);
      
      await base44.entities.WorkInProgress.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        part_barcode: scannedPart.barcode,
        operation_id: wipForm.operation_id,
        operation_name: operation?.operation_name,
        quantity: parseInt(wipForm.quantity),
        started_date: new Date().toISOString(),
        worker_email: user?.email,
        worker_name: user?.full_name,
        notes: wipForm.notes,
        status: 'active'
      });

      // Create transaction record
      await base44.entities.StockTransaction.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: -parseInt(wipForm.quantity),
        operation_name: operation?.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: wipForm.notes
      });

      // Deduct from finished stock
      await base44.entities.Part.update(scannedPart.id, {
        finished_stock: Math.max(0, (scannedPart.finished_stock || 0) - parseInt(wipForm.quantity))
      });

      toast.success('WIP batch started!');
      setShowWipDialog(false);
      setWipForm({ operation_id: '', quantity: '', notes: '' });
      
      // Navigate to My WIP
      navigate(createPageUrl('MyWIP'));
    } catch (e) {
      console.error(e);
      toast.error('Failed to start WIP batch');
    } finally {
      setSaving(false);
    }
  };

  const addToStock = async () => {
    if (!addStockForm.quantity || parseInt(addStockForm.quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      const newStock = (scannedPart.finished_stock || 0) + parseInt(addStockForm.quantity);
      
      await base44.entities.Part.update(scannedPart.id, {
        finished_stock: newStock
      });

      await base44.entities.StockTransaction.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        transaction_type: 'added_to_stock',
        quantity_change: parseInt(addStockForm.quantity),
        user_email: user?.email,
        user_name: user?.full_name,
        notes: addStockForm.notes
      });

      toast.success('Stock updated!', { description: `New total: ${newStock} ${scannedPart.unit || 'pcs'}` });
      setShowAddStockDialog(false);
      setAddStockForm({ quantity: '', notes: '' });
      
      // Refresh part data
      const updatedPart = await base44.entities.Part.filter({ id: scannedPart.id });
      if (updatedPart.length > 0) {
        setScannedPart(updatedPart[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const isLowStock = scannedPart && scannedPart.min_stock_level && 
    (scannedPart.finished_stock || 0) < scannedPart.min_stock_level;

  return (
    <div className="space-y-6 pb-24">
      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Scan Button */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-600 to-blue-700">
        <CardContent className="p-6">
          <Button 
            onClick={() => setShowScanner(true)}
            size="lg"
            className="w-full h-20 text-xl bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
          >
            <ScanBarcode className="w-8 h-8 mr-3" />
            Scan Barcode
          </Button>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name, number, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-12"
              />
            </div>
            <Button onClick={handleSearch} className="h-12 px-6" disabled={searching}>
              {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((part) => (
                <button
                  key={part.id}
                  onClick={() => selectPart(part)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm">{part.part_name}</p>
                      <p className="text-xs text-slate-500">{part.part_number}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{part.finished_stock || 0} {part.unit || 'pcs'}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Scanned Part Result */}
      {scannedPart && !loading && (
        <div className="space-y-4">
          <Card className={`border-0 shadow-md ${isLowStock ? 'border-l-4 border-l-red-500' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {scannedPart.image_url ? (
                    <img 
                      src={scannedPart.image_url} 
                      alt={scannedPart.part_name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{scannedPart.part_name}</CardTitle>
                    <p className="text-sm text-slate-500">{scannedPart.part_number}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{scannedPart.barcode}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setScannedPart(null)}
                  className="text-slate-400"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stock Level */}
              <div className={`p-4 rounded-xl ${isLowStock ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Finished Stock</span>
                  {isLowStock && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Low Stock
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                    {scannedPart.finished_stock || 0}
                  </span>
                  <span className="text-slate-500">{scannedPart.unit || 'pcs'}</span>
                </div>
                {scannedPart.min_stock_level && (
                  <p className="text-xs text-slate-500 mt-1">
                    Min level: {scannedPart.min_stock_level} | Reorder: {scannedPart.reorder_quantity || '-'}
                  </p>
                )}
              </div>

              {/* Active WIP for this part */}
              {activeWips.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Active WIP Batches
                  </p>
                  {activeWips.map((wip) => (
                    <Link key={wip.id} to={createPageUrl(`MyWIP?wip=${wip.id}`)}>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                        <div>
                          <p className="font-medium text-sm text-blue-900">{wip.operation_name}</p>
                          <p className="text-xs text-blue-600">By: {wip.worker_name || wip.worker_email}</p>
                        </div>
                        <Badge className="bg-blue-600">{wip.quantity} {scannedPart.unit || 'pcs'}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  onClick={() => setShowWipDialog(true)}
                  className="h-14 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Start WIP
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowAddStockDialog(true)}
                  className="h-14"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Start WIP Dialog */}
      <Dialog open={showWipDialog} onOpenChange={setShowWipDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start WIP Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Operation / Process</Label>
              <Select 
                value={wipForm.operation_id} 
                onValueChange={(v) => setWipForm({ ...wipForm, operation_id: v })}
              >
                <SelectTrigger className="h-12 mt-1">
                  <SelectValue placeholder="Select operation..." />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.operation_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                placeholder="Enter quantity..."
                value={wipForm.quantity}
                onChange={(e) => setWipForm({ ...wipForm, quantity: e.target.value })}
                className="h-12 mt-1"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={wipForm.notes}
                onChange={(e) => setWipForm({ ...wipForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWipDialog(false)}>
              Cancel
            </Button>
            <Button onClick={startNewWip} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Start Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Quantity to Add</Label>
              <Input
                type="number"
                min="1"
                placeholder="Enter quantity..."
                value={addStockForm.quantity}
                onChange={(e) => setAddStockForm({ ...addStockForm, quantity: e.target.value })}
                className="h-12 mt-1"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g., New delivery, returned items..."
                value={addStockForm.notes}
                onChange={(e) => setAddStockForm({ ...addStockForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addToStock} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}