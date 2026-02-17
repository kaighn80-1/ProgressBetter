import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Wrench, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Loader2,
  Check
} from 'lucide-react';

const UNITS = ['pcs', 'kg', 'm', 'l', 'box', 'set'];

export default function Fixings() {
  const [fixings, setFixings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingFixing, setEditingFixing] = useState(null);
  const [deletingFixing, setDeletingFixing] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    fixing_name: '',
    sku: '',
    barcode: '',
    unit: 'pcs',
    current_stock: '0',
    min_stock_level: '',
    reorder_quantity: '',
    location: '',
    category: '',
    description: ''
  });

  useEffect(() => {
    loadFixings();
  }, []);

  const loadFixings = async () => {
    try {
      const data = await base44.entities.Fixing.list('fixing_name');
      setFixings(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load fixings');
    } finally {
      setLoading(false);
    }
  };

  const filteredFixings = fixings.filter(f =>
    f.fixing_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddDialog = () => {
    setEditingFixing(null);
    setForm({
      fixing_name: '',
      sku: '',
      barcode: '',
      unit: 'pcs',
      current_stock: '0',
      min_stock_level: '',
      reorder_quantity: '',
      location: '',
      category: '',
      description: ''
    });
    setShowDialog(true);
  };

  const openEditDialog = (fixing) => {
    setEditingFixing(fixing);
    setForm({
      fixing_name: fixing.fixing_name || '',
      sku: fixing.sku || '',
      barcode: fixing.barcode || '',
      unit: fixing.unit || 'pcs',
      current_stock: fixing.current_stock?.toString() || '0',
      min_stock_level: fixing.min_stock_level?.toString() || '',
      reorder_quantity: fixing.reorder_quantity?.toString() || '',
      location: fixing.location || '',
      category: fixing.category || '',
      description: fixing.description || ''
    });
    setShowDialog(true);
  };

  const saveFixing = async () => {
    if (!form.fixing_name || !form.sku) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const fixingData = {
        ...form,
        current_stock: form.current_stock ? parseFloat(form.current_stock) : 0,
        min_stock_level: form.min_stock_level ? parseFloat(form.min_stock_level) : null,
        reorder_quantity: form.reorder_quantity ? parseFloat(form.reorder_quantity) : null
      };

      if (editingFixing) {
        await base44.entities.Fixing.update(editingFixing.id, fixingData);
        toast.success('Fixing updated');
      } else {
        await base44.entities.Fixing.create(fixingData);
        toast.success('Fixing created');
      }

      setShowDialog(false);
      loadFixings();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save fixing');
    } finally {
      setSaving(false);
    }
  };

  const deleteFixing = async () => {
    if (!deletingFixing) return;

    try {
      await base44.entities.Fixing.delete(deletingFixing.id);
      toast.success('Fixing deleted');
      setShowDeleteDialog(false);
      setDeletingFixing(null);
      loadFixings();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete fixing');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const lowStockCount = fixings.filter(f => 
    f.min_stock_level && (f.current_stock || 0) < f.min_stock_level
  ).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fixings & Consumables</h1>
          <p className="text-sm text-slate-500">
            {fixings.length} fixings total
            {lowStockCount > 0 && ` • ${lowStockCount} low stock`}
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Add Fixing
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search fixings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Fixings List */}
      <div className="space-y-3">
        {filteredFixings.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <Wrench className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No fixings found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery ? 'Try a different search' : 'Add your first fixing to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFixings.map((fixing) => {
            const isLowStock = fixing.min_stock_level && (fixing.current_stock || 0) < fixing.min_stock_level;
            
            return (
              <Card 
                key={fixing.id} 
                className={`border-0 shadow-md ${isLowStock ? 'border-l-4 border-l-red-500' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-8 h-8 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{fixing.fixing_name}</h3>
                          <p className="text-sm text-slate-500">{fixing.sku}</p>
                          {fixing.location && (
                            <p className="text-xs text-slate-400 mt-1">📍 {fixing.location}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(fixing)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setDeletingFixing(fixing);
                              setShowDeleteDialog(true);
                            }}
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge 
                          variant={isLowStock ? 'destructive' : 'secondary'}
                          className="flex items-center gap-1"
                        >
                          {isLowStock && <AlertTriangle className="w-3 h-3" />}
                          {fixing.current_stock || 0} {fixing.unit || 'pcs'}
                        </Badge>
                        {fixing.min_stock_level && (
                          <span className="text-xs text-slate-500">
                            Min: {fixing.min_stock_level}
                          </span>
                        )}
                        {fixing.category && (
                          <Badge variant="outline" className="text-xs">
                            {fixing.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFixing ? 'Edit Fixing' : 'Add New Fixing'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Fixing Name *</Label>
                <Input
                  value={form.fixing_name}
                  onChange={(e) => setForm({ ...form, fixing_name: e.target.value })}
                  placeholder="e.g., M8 Bolt"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>SKU / Part Number *</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g., BOLT-M8-50"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Barcode</Label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  value={form.current_stock}
                  onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Min Stock Level</Label>
                <Input
                  type="number"
                  value={form.min_stock_level}
                  onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
                  placeholder="Alert threshold"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Reorder Quantity</Label>
                <Input
                  type="number"
                  value={form.reorder_quantity}
                  onChange={(e) => setForm({ ...form, reorder_quantity: e.target.value })}
                  placeholder="Suggested qty"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., Shelf A3"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g., Bolts"
                  className="mt-1"
                />
              </div>

              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Additional details..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveFixing} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {editingFixing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fixing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFixing?.fixing_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFixing} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}