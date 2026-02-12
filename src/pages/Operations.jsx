import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Check,
  GripVertical,
  Flag
} from 'lucide-react';

export default function Operations() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingOp, setEditingOp] = useState(null);
  const [deletingOp, setDeletingOp] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    operation_name: '',
    sequence_number: '',
    description: '',
    is_final: false
  });

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const data = await base44.entities.Operation.list('sequence_number');
      setOperations(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load operations');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingOp(null);
    const nextSeq = operations.length > 0 
      ? Math.max(...operations.map(o => o.sequence_number || 0)) + 10 
      : 10;
    setForm({
      operation_name: '',
      sequence_number: nextSeq.toString(),
      description: '',
      is_final: false
    });
    setShowDialog(true);
  };

  const openEditDialog = (op) => {
    setEditingOp(op);
    setForm({
      operation_name: op.operation_name || '',
      sequence_number: op.sequence_number?.toString() || '',
      description: op.description || '',
      is_final: op.is_final || false
    });
    setShowDialog(true);
  };

  const saveOperation = async () => {
    if (!form.operation_name || !form.sequence_number) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const opData = {
        operation_name: form.operation_name,
        sequence_number: parseInt(form.sequence_number),
        description: form.description,
        is_final: form.is_final
      };

      if (editingOp) {
        await base44.entities.Operation.update(editingOp.id, opData);
        toast.success('Operation updated');
      } else {
        await base44.entities.Operation.create(opData);
        toast.success('Operation created');
      }

      setShowDialog(false);
      loadOperations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save operation');
    } finally {
      setSaving(false);
    }
  };

  const deleteOperation = async () => {
    if (!deletingOp) return;

    try {
      await base44.entities.Operation.delete(deletingOp.id);
      toast.success('Operation deleted');
      setShowDeleteDialog(false);
      setDeletingOp(null);
      loadOperations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete operation');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
          <p className="text-sm text-slate-500">Production workflow stages</p>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Add Operation
        </Button>
      </div>

      {/* Operations List */}
      <div className="space-y-3">
        {operations.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <Settings className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No operations defined</h3>
              <p className="text-sm text-slate-500">
                Add production stages like Cutting, Welding, Assembly, etc.
              </p>
            </CardContent>
          </Card>
        ) : (
          operations.map((op, index) => (
            <Card key={op.id} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <GripVertical className="w-5 h-5" />
                    <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm">
                      {index + 1}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{op.operation_name}</h3>
                      {op.is_final && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <Flag className="w-3 h-3 mr-1" />
                          Final
                        </Badge>
                      )}
                    </div>
                    {op.description && (
                      <p className="text-sm text-slate-500 mt-1">{op.description}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(op)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setDeletingOp(op);
                        setShowDeleteDialog(true);
                      }}
                      className="h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-blue-50">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-900 mb-2">Workflow Tips</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Operations are shown in sequence order</li>
            <li>• Mark the final operation to auto-suggest completing to stock</li>
            <li>• Common stages: Cutting → Forming → Welding → Painting → Assembly → QC</li>
          </ul>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOp ? 'Edit Operation' : 'Add Operation'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Operation Name *</Label>
              <Input
                value={form.operation_name}
                onChange={(e) => setForm({ ...form, operation_name: e.target.value })}
                placeholder="e.g., Cutting, Welding, Assembly"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Sequence Number *</Label>
              <Input
                type="number"
                value={form.sequence_number}
                onChange={(e) => setForm({ ...form, sequence_number: e.target.value })}
                placeholder="10, 20, 30..."
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Lower numbers appear first in the workflow
              </p>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this operation involves..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <Label>Final Operation</Label>
                <p className="text-xs text-slate-500">
                  Mark if this is the last step before finished goods
                </p>
              </div>
              <Switch
                checked={form.is_final}
                onCheckedChange={(checked) => setForm({ ...form, is_final: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveOperation} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {editingOp ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Operation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingOp?.operation_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteOperation} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}