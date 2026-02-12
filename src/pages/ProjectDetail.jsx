import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Search,
  AlertTriangle,
  FolderOpen,
  Calendar,
  ScanBarcode
} from 'lucide-react';

export default function ProjectDetail() {
  const [project, setProject] = useState(null);
  const [parts, setParts] = useState([]);
  const [allParts, setAllParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addPartDialogOpen, setAddPartDialogOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projectData, partsData] = await Promise.all([
        base44.entities.Project.filter({ id: projectId }),
        base44.entities.Part.list()
      ]);
      setProject(projectData[0] || null);
      setAllParts(partsData);
      setParts(partsData.filter(p => p.project_id === projectId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(p => 
    p.part_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unassignedParts = allParts.filter(p => !p.project_id);

  const handleAddPart = async () => {
    if (!selectedPartId) {
      toast.error('Please select a part');
      return;
    }
    try {
      const part = allParts.find(p => p.id === selectedPartId);
      await base44.entities.Part.update(selectedPartId, {
        project_id: projectId,
        project_name: project.project_name
      });
      toast.success(`${part.part_name} added to project`);
      setAddPartDialogOpen(false);
      setSelectedPartId('');
      loadData();
    } catch (e) {
      toast.error('Failed to add part');
    }
  };

  const handleRemovePart = async (part) => {
    try {
      await base44.entities.Part.update(part.id, {
        project_id: null,
        project_name: null
      });
      toast.success(`${part.part_name} removed from project`);
      loadData();
    } catch (e) {
      toast.error('Failed to remove part');
    }
  };

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700'
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">Project not found</p>
        <Link to={createPageUrl('Projects')}>
          <Button variant="link">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Projects')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{project.project_name}</h1>
            <Badge className={statusColors[project.status] || statusColors.active}>
              {project.status}
            </Badge>
          </div>
          {project.project_number && (
            <p className="text-slate-500 text-sm">{project.project_number}</p>
          )}
        </div>
      </div>

      {/* Project Info */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Package className="w-4 h-4" />
              <span>{parts.length} parts</span>
            </div>
            {project.due_date && (
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Due: {new Date(project.due_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          {project.description && (
            <p className="text-slate-500 text-sm mt-3">{project.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Parts Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Parts</h2>
        <Button onClick={() => setAddPartDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Part
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search parts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredParts.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No parts in this project</p>
            <Button variant="link" onClick={() => setAddPartDialogOpen(true)}>
              Add your first part
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredParts.map((part) => {
            const isLowStock = part.min_stock_level && (part.finished_stock || 0) < part.min_stock_level;
            return (
              <Card key={part.id} className={`border-0 shadow-md ${isLowStock ? 'border-l-4 border-l-red-500' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isLowStock ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      {part.image_url ? (
                        <img src={part.image_url} alt={part.part_name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Package className={`w-6 h-6 ${isLowStock ? 'text-red-600' : 'text-slate-400'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900 truncate">{part.part_name}</h3>
                        {isLowStock && (
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{part.part_number}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <ScanBarcode className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400 font-mono">{part.barcode}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                        {part.finished_stock || 0}
                      </p>
                      <p className="text-xs text-slate-500">{part.unit || 'pcs'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-500"
                      onClick={() => handleRemovePart(part)}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Part Dialog */}
      <Dialog open={addPartDialogOpen} onOpenChange={setAddPartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Part to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {unassignedParts.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500 text-sm">All parts are already assigned to projects</p>
                <Link to={createPageUrl('Parts')}>
                  <Button variant="link" className="mt-2">
                    Create new parts
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Part</Label>
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a part..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedParts.map((part) => (
                        <SelectItem key={part.id} value={part.id}>
                          {part.part_name} ({part.part_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAddPart}>
                  Add to Project
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}