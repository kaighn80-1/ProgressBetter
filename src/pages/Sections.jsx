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
  FolderOpen, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Loader2,
  Check,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export default function Sections() {
  const [sections, setSections] = useState([]);
  const [projects, setProjects] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [deletingSection, setDeletingSection] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    section_name: '',
    project_id: '',
    description: '',
    order_index: '0'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sectionsData, projectsData, subsectionsData] = await Promise.all([
        base44.entities.Section.list('order_index'),
        base44.entities.Project.list('project_name'),
        base44.entities.Subsection.list()
      ]);
      setSections(sectionsData);
      setProjects(projectsData);
      setSubsections(subsectionsData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const filteredSections = sections.filter(s =>
    s.section_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddDialog = () => {
    setEditingSection(null);
    setForm({
      section_name: '',
      project_id: '',
      description: '',
      order_index: '0'
    });
    setShowDialog(true);
  };

  const openEditDialog = (section) => {
    setEditingSection(section);
    setForm({
      section_name: section.section_name || '',
      project_id: section.project_id || '',
      description: section.description || '',
      order_index: section.order_index?.toString() || '0'
    });
    setShowDialog(true);
  };

  const saveSection = async () => {
    if (!form.section_name || !form.project_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const project = projects.find(p => p.id === form.project_id);
      const sectionData = {
        ...form,
        project_name: project?.project_name,
        order_index: parseFloat(form.order_index) || 0
      };

      if (editingSection) {
        await base44.entities.Section.update(editingSection.id, sectionData);
        toast.success('Section updated');
      } else {
        await base44.entities.Section.create(sectionData);
        toast.success('Section created');
      }

      setShowDialog(false);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async () => {
    if (!deletingSection) return;

    try {
      await base44.entities.Section.delete(deletingSection.id);
      toast.success('Section deleted');
      setShowDeleteDialog(false);
      setDeletingSection(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete section');
    }
  };

  const getSubsectionCount = (sectionId) => {
    return subsections.filter(ss => ss.section_id === sectionId).length;
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sections</h1>
          <p className="text-sm text-slate-500">{sections.length} sections total</p>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Add Section
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        {filteredSections.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No sections found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery ? 'Try a different search' : 'Add your first section to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSections.map((section) => (
            <Card key={section.id} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-7 h-7 text-blue-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{section.section_name}</h3>
                        <p className="text-sm text-slate-500">{section.project_name}</p>
                        {section.description && (
                          <p className="text-sm text-slate-600 mt-1">{section.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditDialog(section)}
                          className="h-8 w-8"
                        >
                          <Edit className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setDeletingSection(section);
                            setShowDeleteDialog(true);
                          }}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline">
                        {getSubsectionCount(section.id)} subsections
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Order: {section.order_index || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'Add New Section'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Section Name *</Label>
              <Input
                value={form.section_name}
                onChange={(e) => setForm({ ...form, section_name: e.target.value })}
                placeholder="e.g., Frame Assembly"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Order Index</Label>
              <Input
                type="number"
                value={form.order_index}
                onChange={(e) => setForm({ ...form, order_index: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveSection} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {editingSection ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSection?.section_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSection} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}