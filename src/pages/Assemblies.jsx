import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Assemblies() {
  const [assemblies, setAssemblies] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    assembly_number: '',
    assembly_name: '',
    description: '',
    required_parts: [],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assembliesData, partsData] = await Promise.all([
        base44.entities.Assembly.list('-updated_date'),
        base44.entities.Part.list()
      ]);
      setAssemblies(assembliesData);
      setParts(partsData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateAvailableQty = (assembly) => {
    if (!assembly.required_parts || assembly.required_parts.length === 0) {
      return 0;
    }

    const availableQtys = assembly.required_parts.map(req => {
      const part = parts.find(p => p.id === req.part_id);
      if (!part) return 0;
      const stockAvailable = part.finished_stock || 0;
      return Math.floor(stockAvailable / req.quantity_needed);
    });

    return Math.min(...availableQtys);
  };

  const resetForm = () => {
    setFormData({
      assembly_number: '',
      assembly_name: '',
      description: '',
      required_parts: [],
      notes: ''
    });
  };

  const handleAddPart = () => {
    setFormData(prev => ({
      ...prev,
      required_parts: [
        ...prev.required_parts,
        { part_id: '', part_number: '', part_name: '', quantity_needed: 1 }
      ]
    }));
  };

  const handleRemovePart = (index) => {
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.filter((_, i) => i !== index)
    }));
  };

  const handlePartChange = (index, partId) => {
    const selectedPart = parts.find(p => p.id === partId);
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.map((req, i) =>
        i === index
          ? {
              part_id: partId,
              part_number: selectedPart?.part_number || '',
              part_name: selectedPart?.part_name || '',
              quantity_needed: req.quantity_needed
            }
          : req
      )
    }));
  };

  const handleQuantityChange = (index, quantity) => {
    setFormData(prev => ({
      ...prev,
      required_parts: prev.required_parts.map((req, i) =>
        i === index ? { ...req, quantity_needed: parseInt(quantity) || 0 } : req
      )
    }));
  };

  const handleSave = async () => {
    if (!formData.assembly_number.trim()) {
      toast.error('Assembly Number is required');
      return;
    }
    if (!formData.assembly_name.trim()) {
      toast.error('Assembly Name is required');
      return;
    }
    if (formData.required_parts.length === 0) {
      toast.error('Add at least one required part');
      return;
    }

    // Check for duplicate assembly number
    const exists = assemblies.some(
      a => a.assembly_number === formData.assembly_number && a.id !== deleteId
    );
    if (exists) {
      toast.error('Assembly Number already exists');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.Assembly.create({
        assembly_number: formData.assembly_number,
        assembly_name: formData.assembly_name,
        description: formData.description,
        required_parts: formData.required_parts,
        completed_quantity: 0,
        assembly_stock: 0,
        notes: formData.notes
      });

      toast.success('Assembly created successfully!');
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create assembly');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await base44.entities.Assembly.delete(deleteId);
      toast.success('Assembly deleted');
      setShowDeleteDialog(false);
      setDeleteId(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete assembly');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-slate-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1E293B' }}>Assemblies</h1>
          <p style={{ color: '#64748B' }}>Manage assembly bill of materials and availability</p>
        </div>
        <Button
          size="lg"
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          style={{ backgroundColor: '#3B82F6', color: 'white' }}
        >
          <Plus className="w-5 h-5 mr-2" />
          New Assembly
        </Button>
      </div>

      {/* Assemblies List */}
      {assemblies.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E293B' }}>
              No assemblies yet
            </h3>
            <p className="mb-6" style={{ color: '#64748B' }}>
              Create your first assembly to manage BOMs
            </p>
            <Button
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
              style={{ backgroundColor: '#3B82F6', color: 'white' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Assembly
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assemblies.map((assembly) => {
            const availableQty = calculateAvailableQty(assembly);
            const isExpanded = expandedId === assembly.id;

            return (
              <Card key={assembly.id} className="border-0 shadow-md">
                <div
                  className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : assembly.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg" style={{ color: '#1E293B' }}>
                          {assembly.assembly_number}
                        </h3>
                        <Badge
                          style={{
                            backgroundColor: availableQty > 0 ? '#D1FAE5' : '#FEE2E2',
                            color: availableQty > 0 ? '#065F46' : '#991B1B'
                          }}
                        >
                          Available: {availableQty}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#64748B' }}>
                        {assembly.assembly_name}
                      </p>
                      {assembly.description && (
                        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                          {assembly.description}
                        </p>
                      )}
                    </div>
                    <button className="p-2 hover:bg-slate-100 rounded transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" style={{ color: '#64748B' }} />
                      ) : (
                        <ChevronDown className="w-5 h-5" style={{ color: '#64748B' }} />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-6 py-4 bg-slate-50">
                    {/* Bill of Materials */}
                    <div className="mb-4">
                      <p className="font-semibold text-sm mb-3" style={{ color: '#1E293B' }}>
                        Required Parts
                      </p>
                      <div className="space-y-2">
                        {assembly.required_parts?.map((req, idx) => {
                          const part = parts.find(p => p.id === req.part_id);
                          const partStock = part?.finished_stock || 0;
                          const canMake = Math.floor(partStock / req.quantity_needed);

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-white border flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm" style={{ color: '#1E293B' }}>
                                  {req.part_number} - {req.part_name}
                                </p>
                                <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                                  {req.quantity_needed} per assembly • Stock: {partStock} • Can make: {canMake}
                                </p>
                              </div>
                              <Badge variant="outline">{req.quantity_needed} needed</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Available Quantity Calculation */}
                    <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#EFF6FF', borderLeft: '3px solid #3B82F6' }}>
                      <p className="text-xs font-semibold" style={{ color: '#1E40AF' }}>
                        Available for Delivery
                      </p>
                      <p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>
                        {availableQty}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#1E40AF' }}>
                        Limited by: {assembly.required_parts?.[0]?.part_name || 'N/A'}
                      </p>
                    </div>

                    {assembly.notes && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold mb-1" style={{ color: '#64748B' }}>
                          Notes
                        </p>
                        <p className="text-sm" style={{ color: '#64748B' }}>
                          {assembly.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDeleteId(assembly.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Assembly</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Assembly Number *</Label>
              <Input
                value={formData.assembly_number}
                onChange={(e) => setFormData({ ...formData, assembly_number: e.target.value })}
                placeholder="e.g., ASSY-001"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Assembly Name *</Label>
              <Input
                value={formData.assembly_name}
                onChange={(e) => setFormData({ ...formData, assembly_name: e.target.value })}
                placeholder="e.g., Main Frame Assembly"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Assembly description..."
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Required Parts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Required Parts (Bill of Materials) *</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddPart}
                  style={{ borderColor: '#3B82F6', color: '#3B82F6' }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Part
                </Button>
              </div>

              {formData.required_parts.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: '#64748B' }}>
                  No parts added yet
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.required_parts.map((req, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border flex items-end gap-3"
                      style={{ backgroundColor: '#F8FAFC' }}
                    >
                      <div className="flex-1">
                        <Label className="text-xs mb-1 block">Part</Label>
                        <Select value={req.part_id} onValueChange={(val) => handlePartChange(idx, val)}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select part..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parts.map((part) => (
                              <SelectItem key={part.id} value={part.id}>
                                {part.part_number} - {part.part_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div style={{ minWidth: '120px' }}>
                        <Label className="text-xs mb-1 block">Qty Needed</Label>
                        <Input
                          type="number"
                          min="1"
                          value={req.quantity_needed}
                          onChange={(e) => handleQuantityChange(idx, e.target.value)}
                          className="h-10"
                        />
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemovePart(idx)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: '#3B82F6', color: 'white' }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Create Assembly'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assembly</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={saving}
            style={{ backgroundColor: '#EF4444', color: 'white' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Delete
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}