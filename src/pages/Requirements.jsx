import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Plus, 
  Target, 
  Package,
  Calendar,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Flame
} from 'lucide-react';

export default function Requirements() {
  const [user, setUser] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [parts, setParts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReq, setDeletingReq] = useState(null);
  const [formData, setFormData] = useState({
    part_id: '',
    project_id: '',
    required_quantity: '',
    due_date: '',
    priority: 'medium',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, reqData, partsData, projectsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.PartRequirement.filter({ status: 'active' }),
        base44.entities.Part.list(),
        base44.entities.Project.filter({ status: 'active' })
      ]);
      setUser(userData);
      setRequirements(reqData);
      setParts(partsData);
      setProjects(projectsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  const getPartStock = (partId) => {
    const part = parts.find(p => p.id === partId);
    return part?.finished_stock || 0;
  };

  const calculateShortfall = (req) => {
    const currentStock = getPartStock(req.part_id);
    return Math.max(0, req.required_quantity - currentStock);
  };

  const calculateUrgencyScore = (req) => {
    const shortfall = calculateShortfall(req);
    if (shortfall === 0) return 0;
    
    const priorityScores = { urgent: 100, high: 75, medium: 50, low: 25 };
    let score = priorityScores[req.priority] || 50;
    
    // Add urgency based on due date
    if (req.due_date) {
      const daysUntilDue = Math.ceil((new Date(req.due_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue < 0) score += 50; // Overdue
      else if (daysUntilDue <= 1) score += 40;
      else if (daysUntilDue <= 3) score += 30;
      else if (daysUntilDue <= 7) score += 20;
    }
    
    // Add urgency based on shortfall percentage
    const shortfallPercent = (shortfall / req.required_quantity) * 100;
    if (shortfallPercent >= 100) score += 20;
    else if (shortfallPercent >= 75) score += 15;
    else if (shortfallPercent >= 50) score += 10;
    
    return score;
  };

  const sortedRequirements = [...requirements].sort((a, b) => 
    calculateUrgencyScore(b) - calculateUrgencyScore(a)
  );

  const handleOpenDialog = () => {
    setFormData({
      part_id: '',
      project_id: '',
      required_quantity: '',
      due_date: '',
      priority: 'medium',
      notes: ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.part_id || !formData.required_quantity) {
      toast.error('Part and quantity are required');
      return;
    }
    try {
      const part = parts.find(p => p.id === formData.part_id);
      const project = projects.find(p => p.id === formData.project_id);
      
      await base44.entities.PartRequirement.create({
        ...formData,
        required_quantity: Number(formData.required_quantity),
        part_name: part?.part_name,
        part_number: part?.part_number,
        project_name: project?.project_name || null,
        status: 'active'
      });
      toast.success('Requirement added');
      setDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error('Failed to save requirement');
    }
  };

  const handleComplete = async (req) => {
    try {
      await base44.entities.PartRequirement.update(req.id, { status: 'completed' });
      toast.success('Requirement completed');
      loadData();
    } catch (e) {
      toast.error('Failed to complete requirement');
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.PartRequirement.delete(deletingReq.id);
      toast.success('Requirement deleted');
      setDeleteDialogOpen(false);
      setDeletingReq(null);
      loadData();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const getPriorityBadge = (req) => {
    const score = calculateUrgencyScore(req);
    const shortfall = calculateShortfall(req);
    
    if (shortfall === 0) {
      return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
    }
    if (score >= 120) {
      return <Badge className="bg-red-100 text-red-700"><Flame className="w-3 h-3 mr-1" />Critical</Badge>;
    }
    if (score >= 90) {
      return <Badge className="bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3 mr-1" />Urgent</Badge>;
    }
    if (score >= 60) {
      return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />High</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-600">Normal</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-20">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Priorities</h1>
          <p className="text-slate-500 text-sm">Parts needed for production</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Requirement
          </Button>
        )}
      </div>

      {sortedRequirements.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No active requirements</p>
            {isAdmin && (
              <Button variant="link" onClick={handleOpenDialog}>
                Add a requirement
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedRequirements.map((req, index) => {
            const currentStock = getPartStock(req.part_id);
            const shortfall = calculateShortfall(req);
            const isOverdue = req.due_date && new Date(req.due_date) < new Date();
            
            return (
              <Card key={req.id} className={`border-0 shadow-md ${shortfall > 0 && index < 3 ? 'border-l-4 border-l-orange-500' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-slate-500">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-slate-900">{req.part_name}</h3>
                        {getPriorityBadge(req)}
                      </div>
                      <p className="text-sm text-slate-500">{req.part_number}</p>
                      {req.project_name && (
                        <p className="text-xs text-blue-600 mt-1">Project: {req.project_name}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-slate-500">Need: </span>
                          <span className="font-semibold">{req.required_quantity}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Have: </span>
                          <span className={`font-semibold ${currentStock < req.required_quantity ? 'text-red-600' : 'text-green-600'}`}>
                            {currentStock}
                          </span>
                        </div>
                        {shortfall > 0 && (
                          <div>
                            <span className="text-slate-500">Short: </span>
                            <span className="font-semibold text-orange-600">{shortfall}</span>
                          </div>
                        )}
                      </div>
                      {req.due_date && (
                        <div className={`flex items-center gap-1 mt-2 text-xs ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                          <Calendar className="w-3 h-3" />
                          {isOverdue ? 'Overdue: ' : 'Due: '}
                          {new Date(req.due_date).toLocaleDateString()}
                        </div>
                      )}
                      {req.notes && (
                        <p className="text-xs text-slate-400 mt-2">{req.notes}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {shortfall === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleComplete(req)}
                            className="text-green-600"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingReq(req);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Requirement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Part *</Label>
              <Select value={formData.part_id} onValueChange={(v) => setFormData({ ...formData, part_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select part..." />
                </SelectTrigger>
                <SelectContent>
                  {parts.map((part) => (
                    <SelectItem key={part.id} value={part.id}>
                      {part.part_name} ({part.part_number}) - Stock: {part.finished_stock || 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select value={formData.project_id} onValueChange={(v) => setFormData({ ...formData, project_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No project</SelectItem>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity Needed *</Label>
                <Input
                  type="number"
                  value={formData.required_quantity}
                  onChange={(e) => setFormData({ ...formData, required_quantity: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
            <Button className="w-full" onClick={handleSave}>
              Add Requirement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requirement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the requirement for "{deletingReq?.part_name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}