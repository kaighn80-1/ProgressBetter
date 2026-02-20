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
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Assemblies() {
  const [assemblies, setAssemblies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    assembly_number: '',
    assembly_name: '',
    description: '',
    project_id: '',
    target_quantity: 0,
    completed_quantity: 0,
    assembly_stock: 0,
    due_date: '',
    status: 'In Progress',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assembliesData, projectsData] = await Promise.all([
        base44.entities.Assembly.list('-updated_date', 100),
        base44.entities.Project.list('-updated_date', 100)
      ]);
      setAssemblies(assembliesData);
      setProjects(projectsData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load assemblies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (assembly = null) => {
    if (assembly) {
      setEditingId(assembly.id);
      setFormData(assembly);
    } else {
      setEditingId(null);
      setFormData({
        assembly_number: '',
        assembly_name: '',
        description: '',
        project_id: '',
        target_quantity: 0,
        completed_quantity: 0,
        assembly_stock: 0,
        due_date: '',
        status: 'In Progress',
        notes: ''
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.assembly_number || !formData.assembly_name || !formData.project_id) {
      toast.error('Assembly Number, Name, and Project are required');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.Assembly.update(editingId, formData);
        toast.success('Assembly updated');
      } else {
        await base44.entities.Assembly.create(formData);
        toast.success('Assembly created');
      }
      setShowDialog(false);
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error(editingId ? 'Failed to update assembly' : 'Failed to create assembly');
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
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete assembly');
    } finally {
      setSaving(false);
    }
  };

  const getChildParts = async (assemblyId) => {
    try {
      const parts = await base44.entities.Part.filter({ parent_assembly_id: assemblyId }, '-updated_date', 50);
      return parts;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'Ready':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Delivered':
        return { bg: '#E5E7EB', text: '#374151' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const getProjectName = (projectId) => {
    return projects.find(p => p.id === projectId)?.project_name || 'Unknown Project';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3B82F6' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1E293B' }}>Assemblies</h1>
          <p style={{ color: '#64748B' }}>Manage assembly configurations and track completed quantities</p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          style={{ backgroundColor: '#3B82F6', color: 'white' }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Assembly
        </Button>
      </div>

      {assemblies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#94A3B8' }} />
            <p style={{ color: '#64748B' }}>No assemblies created yet. Create your first assembly to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assemblies.map((assembly) => (
            <AssemblyCard
              key={assembly.id}
              assembly={assembly}
              isExpanded={expandedId === assembly.id}
              onToggleExpand={() => setExpandedId(expandedId === assembly.id ? null : assembly.id)}
              onEdit={() => handleOpenDialog(assembly)}
              onDelete={() => {
                setDeleteId(assembly.id);
                setShowDeleteDialog(true);
              }}
              projectName={getProjectName(assembly.project_id)}
              statusColor={getStatusColor(assembly.status)}
              getChildParts={getChildParts}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Assembly' : 'Create New Assembly'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="e.g., Main Module"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Project *</Label>
              <Select value={formData.project_id} onValueChange={(val) => setFormData({ ...formData, project_id: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this assembly..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Target Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.target_quantity}
                  onChange={(e) => setFormData({ ...formData, target_quantity: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Completed Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.completed_quantity}
                  onChange={(e) => setFormData({ ...formData, completed_quantity: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Ready">Ready</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assembly Stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.assembly_stock}
                  onChange={(e) => setFormData({ ...formData, assembly_stock: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: '#3B82F6', color: 'white' }}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assembly?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any parts linked to this assembly will retain their reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={saving}
            style={{ backgroundColor: '#EF4444', color: 'white' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssemblyCard({ assembly, isExpanded, onToggleExpand, onEdit, onDelete, projectName, statusColor, getChildParts }) {
  const [childParts, setChildParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(false);

  const handleExpandClick = async () => {
    if (!isExpanded) {
      setLoadingParts(true);
      try {
        const parts = await getChildParts(assembly.id);
        setChildParts(parts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingParts(false);
      }
    }
    onToggleExpand();
  };

  return (
    <Card>
      <div className="flex items-center justify-between p-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold" style={{ color: '#1E293B' }}>
              {assembly.assembly_number}
            </h3>
            <Badge style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>
              {assembly.status}
            </Badge>
          </div>
          <p style={{ color: '#64748B' }}>{assembly.assembly_name}</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            Project: {projectName} • Target: {assembly.target_quantity} • Completed: {assembly.completed_quantity}
            {assembly.due_date && ` • Due: ${format(new Date(assembly.due_date), 'MMM d, yyyy')}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExpandClick}>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t px-6 py-4 bg-slate-50">
          {assembly.description && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">Description</p>
              <p style={{ color: '#64748B' }}>{assembly.description}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg border">
              <p className="text-xs text-slate-600 font-semibold">Target</p>
              <p className="text-xl font-bold" style={{ color: '#3B82F6' }}>{assembly.target_quantity}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <p className="text-xs text-slate-600 font-semibold">Completed</p>
              <p className="text-xl font-bold" style={{ color: '#10B981' }}>{assembly.completed_quantity}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <p className="text-xs text-slate-600 font-semibold">Stock</p>
              <p className="text-xl font-bold" style={{ color: '#F59E0B' }}>{assembly.assembly_stock}</p>
            </div>
          </div>

          {assembly.notes && (
            <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-semibold text-amber-900 mb-1">Notes</p>
              <p className="text-sm text-amber-800">{assembly.notes}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">
              Component Parts {loadingParts && <Loader2 className="w-3 h-3 inline animate-spin" />}
            </p>
            {childParts.length === 0 ? (
              <p style={{ color: '#94A3B8' }} className="text-sm">No component parts assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {childParts.map((part) => (
                  <div key={part.id} className="p-2 bg-white rounded border text-sm">
                    <div className="flex justify-between">
                      <span className="font-mono font-bold">{part.part_number}</span>
                      <span style={{ color: '#64748B' }}>{part.part_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}