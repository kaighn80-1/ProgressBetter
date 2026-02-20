import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Loader2,
  X,
  Upload,
  Check,
  Copy,
  ChevronUp,
  ChevronDown,
  Settings,
  Wrench,
  ArrowUpDown
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const UNITS = ['pcs', 'kg', 'm', 'l', 'box', 'set'];

export default function Parts() {
  const [parts, setParts] = useState([]);
  const [operations, setOperations] = useState([]);
  const [fixings, setFixings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [deletingPart, setDeletingPart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);
  const [reverseOrder, setReverseOrder] = useState(() => {
    const saved = localStorage.getItem('parts-reverse-order');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [form, setForm] = useState({
    part_name: '',
    part_number: '',
    description: '',
    barcode: '',
    unit: 'pcs',
    min_stock_level: '',
    reorder_quantity: '',
    finished_stock: '',
    image_url: '',
    category: '',
    required_operations: [],
    project_id: '',
    section_id: '',
    subsection_id: '',
    tooling_required: '',
    tooling_location: '',
    finish_type: '',
    assembly_number: '',
    location: '',
    required_fixings: [],
    allow_sym_opp: false,
    is_rh_variant: false,
    rh_part_id: '',
    rh_part_number: '',
    rh_part_name: ''
  });

  useEffect(() => {
    loadParts();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.error(e);
    }
  };

  const loadParts = async () => {
    try {
      const [partsData, opsData, fixingsData, projectsData, sectionsData, subsectionsData] = await Promise.all([
        base44.entities.Part.list(),
        base44.entities.Operation.list('sequence_number'),
        base44.entities.Fixing.list('fixing_name'),
        base44.entities.Project.list('project_name'),
        base44.entities.Section.list('order_index'),
        base44.entities.Subsection.list('order_index')
      ]);
      
      // Sort parts by project_num, module_letter (A→Z), part_seq
      const sortedParts = partsData.sort((a, b) => {
        // Primary sort: project_num (ascending)
        const projA = a.project_num ?? 0;
        const projB = b.project_num ?? 0;
        if (projA !== projB) return projA - projB;
        
        // Secondary sort: module_letter (A→Z ascending, explicitly)
        const modA = (a.module_letter || '').toUpperCase();
        const modB = (b.module_letter || '').toUpperCase();
        if (modA < modB) return -1;
        if (modA > modB) return 1;
        
        // Tertiary sort: part_seq (ascending)
        const seqA = a.part_seq ?? 0;
        const seqB = b.part_seq ?? 0;
        return seqA - seqB;
      });
      
      setParts(sortedParts);
      setOperations(opsData);
      setFixings(fixingsData);
      setProjects(projectsData);
      setSections(sectionsData);
      setSubsections(subsectionsData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load parts');
    } finally {
      setLoading(false);
    }
  };

  // Sort by part_number DESCENDING (string sort)
  let filteredParts = parts
    .filter(p =>
      p.part_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const partNumA = (a.part_number || '').toString();
      const partNumB = (b.part_number || '').toString();
      // Descending: higher values (L) before lower values (A)
      return partNumB.localeCompare(partNumA);
    });

  // Apply visual reversal if toggle is ON
  if (reverseOrder) {
    filteredParts = [...filteredParts].reverse();
  }

  const openAddDialog = () => {
    setEditingPart(null);
    setForm({
      part_name: '',
      part_number: '',
      description: '',
      barcode: '',
      unit: 'pcs',
      min_stock_level: '',
      reorder_quantity: '',
      finished_stock: '0',
      image_url: '',
      category: '',
      required_operations: [],
      project_id: '',
      section_id: '',
      subsection_id: '',
      tooling_required: '',
      tooling_location: '',
      finish_type: '',
      assembly_number: '',
      location: '',
      required_fixings: [],
      allow_sym_opp: false,
      is_rh_variant: false,
      rh_part_id: '',
      rh_part_number: '',
      rh_part_name: ''
    });
    setShowDialog(true);
  };

  const openEditDialog = (part) => {
    setEditingPart(part);
    setForm({
      part_name: part.part_name || '',
      part_number: part.part_number || '',
      description: part.description || '',
      barcode: part.barcode || '',
      unit: part.unit || 'pcs',
      min_stock_level: part.min_stock_level?.toString() || '',
      reorder_quantity: part.reorder_quantity?.toString() || '',
      finished_stock: part.finished_stock?.toString() || '0',
      image_url: part.image_url || '',
      category: part.category || '',
      required_operations: part.required_operations || [],
      project_id: part.project_id || '',
      section_id: part.section_id || '',
      subsection_id: part.subsection_id || '',
      tooling_required: part.tooling_required || '',
      tooling_location: part.tooling_location || '',
      finish_type: part.finish_type || '',
      assembly_number: part.assembly_number || '',
      location: part.location || '',
      required_fixings: part.required_fixings || [],
      allow_sym_opp: part.allow_sym_opp || false,
      is_rh_variant: part.is_rh_variant || false,
      rh_part_id: part.rh_part_id || '',
      rh_part_number: part.rh_part_number || '',
      rh_part_name: part.rh_part_name || ''
    });
    setShowDialog(true);
  };

  const addFixing = () => {
    setForm({
      ...form,
      required_fixings: [...form.required_fixings, { fixing_id: '', fixing_name: '', quantity_per_unit: 1 }]
    });
  };

  const updateFixing = (index, field, value) => {
    const updated = [...form.required_fixings];
    if (field === 'fixing_id') {
      const fixing = fixings.find(f => f.id === value);
      updated[index] = { ...updated[index], fixing_id: value, fixing_name: fixing?.fixing_name || '' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setForm({ ...form, required_fixings: updated });
  };

  const removeFixing = (index) => {
    setForm({ ...form, required_fixings: form.required_fixings.filter((_, i) => i !== index) });
  };

  const filteredSections = sections.filter(s => !form.project_id || s.project_id === form.project_id);
  const filteredSubsections = subsections.filter(ss => !form.section_id || ss.section_id === form.section_id);

  const toggleOperation = (opId) => {
    const current = form.required_operations || [];
    if (current.includes(opId)) {
      setForm({ ...form, required_operations: current.filter(id => id !== opId) });
    } else {
      setForm({ ...form, required_operations: [...current, opId] });
    }
  };

  const moveOperationUp = (index) => {
    if (index === 0) return;
    const ops = [...form.required_operations];
    [ops[index - 1], ops[index]] = [ops[index], ops[index - 1]];
    setForm({ ...form, required_operations: ops });
  };

  const moveOperationDown = (index) => {
    if (index === form.required_operations.length - 1) return;
    const ops = [...form.required_operations];
    [ops[index], ops[index + 1]] = [ops[index + 1], ops[index]];
    setForm({ ...form, required_operations: ops });
  };

  const generateBarcode = () => {
    const prefix = 'PT';
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    setForm({ ...form, barcode: `${prefix}${random}${timestamp}` });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, image_url: file_url });
      toast.success('Image uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const savePart = async () => {
    if (!form.part_name || !form.part_number || !form.barcode) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check for duplicate barcode
    const existingBarcode = parts.find(p => 
      p.barcode === form.barcode && p.id !== editingPart?.id
    );
    if (existingBarcode) {
      toast.error('Barcode already exists');
      return;
    }

    setSaving(true);
    try {
      const opNames = form.required_operations.map(opId => {
        const op = operations.find(o => o.id === opId);
        return op?.operation_name || '';
      });
      
      const project = projects.find(p => p.id === form.project_id);
      const section = sections.find(s => s.id === form.section_id);
      const subsection = subsections.find(ss => ss.id === form.subsection_id);
      
      // If RH part is selected, cache its details
      let rhPartNumber = form.rh_part_number;
      let rhPartName = form.rh_part_name;
      if (form.allow_sym_opp && form.rh_part_id) {
        const rhPart = parts.find(p => p.id === form.rh_part_id);
        if (rhPart) {
          rhPartNumber = rhPart.part_number;
          rhPartName = rhPart.part_name;
        }
      }

      // Auto-compute sorting fields from part_number
      const partNum = form.part_number || '';
      let projectNum = 0;
      let moduleLetter = '';
      let partSeq = 0;
      
      // Extract first 3 chars as project_num
      if (partNum.length >= 3) {
        const first3 = partNum.substring(0, 3);
        const parsed = parseInt(first3, 10);
        if (!isNaN(parsed)) {
          projectNum = parsed;
        }
      }
      
      // Extract 4th char as module_letter
      if (partNum.length >= 4) {
        moduleLetter = partNum.charAt(3);
      }
      
      // Extract last 5 chars as part_seq
      if (partNum.length >= 5) {
        const last5 = partNum.substring(partNum.length - 5);
        const parsed = parseInt(last5, 10);
        if (!isNaN(parsed)) {
          partSeq = parsed;
        }
      }

      const partData = {
        ...form,
        min_stock_level: form.min_stock_level ? parseFloat(form.min_stock_level) : null,
        reorder_quantity: form.reorder_quantity ? parseFloat(form.reorder_quantity) : null,
        finished_stock: form.finished_stock ? parseFloat(form.finished_stock) : 0,
        required_operation_names: opNames,
        project_name: project?.project_name || null,
        section_name: section?.section_name || null,
        subsection_name: subsection?.subsection_name || null,
        rh_part_number: rhPartNumber,
        rh_part_name: rhPartName,
        project_num: projectNum,
        module_letter: moduleLetter,
        part_seq: partSeq
      };

      if (editingPart) {
        await base44.entities.Part.update(editingPart.id, partData);
        toast.success('Part updated');
      } else {
        await base44.entities.Part.create(partData);
        toast.success('Part created');
      }

      setShowDialog(false);
      loadParts();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save part');
    } finally {
      setSaving(false);
    }
  };

  const deletePart = async () => {
    if (!deletingPart) return;

    try {
      await base44.entities.Part.delete(deletingPart.id);
      toast.success('Part deleted');
      setShowDeleteDialog(false);
      setDeletingPart(null);
      loadParts();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete part');
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

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts</h1>
          <p className="text-sm text-slate-500">{parts.length} parts total</p>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Add Part
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search parts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Parts List */}
      <div className="space-y-3">
        {filteredParts.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No parts found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery ? 'Try a different search' : 'Add your first part to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredParts.map((part) => {
            const isLowStock = part.min_stock_level && (part.finished_stock || 0) < part.min_stock_level;
            
            return (
              <Card 
                key={part.id} 
                className={`border-0 shadow-md ${isLowStock ? 'border-l-4 border-l-red-500' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {part.image_url ? (
                      <img 
                        src={part.image_url} 
                        alt={part.part_name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Package className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{part.part_number}</h3>
                          <p className="text-sm text-slate-600 font-medium mt-1">{part.part_name}</p>
                          <p className="text-xs text-slate-400 font-mono mt-1">{part.barcode}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(part)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setDeletingPart(part);
                              setShowDeleteDialog(true);
                            }}
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {part.project_num !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            P: {part.project_num} / M: {part.module_letter || '-'} / S: {part.part_seq}
                          </Badge>
                        )}
                        <Badge 
                          variant={isLowStock ? 'destructive' : 'secondary'}
                          className="flex items-center gap-1"
                        >
                          {isLowStock && <AlertTriangle className="w-3 h-3" />}
                          {part.finished_stock || 0} {part.unit || 'pcs'}
                        </Badge>
                        {part.min_stock_level && (
                          <span className="text-xs text-slate-500">
                            Min: {part.min_stock_level}
                          </span>
                        )}
                        {part.required_operations?.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Settings className="w-3 h-3 mr-1" />
                            {part.required_operations.length} ops
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
            <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Part Name *</Label>
                <Input
                  value={form.part_name}
                  onChange={(e) => setForm({ ...form, part_name: e.target.value })}
                  placeholder="e.g., Steel Bracket A"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Part Number / SKU *</Label>
                <Input
                  value={form.part_number}
                  onChange={(e) => setForm({ ...form, part_number: e.target.value })}
                  placeholder="e.g., SBA-001"
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

              <div className="col-span-2">
                <Label>Barcode *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Barcode string"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={generateBarcode}>
                    Generate
                  </Button>
                </div>
              </div>

              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Part description..."
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
                  placeholder="Suggested order qty"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  value={form.finished_stock}
                  onChange={(e) => setForm({ ...form, finished_stock: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g., Brackets"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., Shelf B2"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, section_id: '', subsection_id: '' })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Section</Label>
                <Select value={form.section_id} onValueChange={(v) => setForm({ ...form, section_id: v, subsection_id: '' })} disabled={!form.project_id}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {filteredSections.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.section_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Subsection</Label>
                <Select value={form.subsection_id} onValueChange={(v) => setForm({ ...form, subsection_id: v })} disabled={!form.section_id}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {filteredSubsections.map(ss => (
                      <SelectItem key={ss.id} value={ss.id}>{ss.subsection_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tooling Required</Label>
                <Input
                  value={form.tooling_required}
                  onChange={(e) => setForm({ ...form, tooling_required: e.target.value })}
                  placeholder="e.g., Drill press, jig"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Tooling Location</Label>
                <Input
                  value={form.tooling_location}
                  onChange={(e) => setForm({ ...form, tooling_location: e.target.value })}
                  placeholder="e.g., Tool rack 3"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Finish Type</Label>
                <Input
                  value={form.finish_type}
                  onChange={(e) => setForm({ ...form, finish_type: e.target.value })}
                  placeholder="e.g., Powder coat, Polish"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Assembly Number</Label>
                <Input
                  value={form.assembly_number}
                  onChange={(e) => setForm({ ...form, assembly_number: e.target.value })}
                  placeholder="Parent assembly"
                  className="mt-1"
                />
              </div>

              <div className="col-span-2">
                <Label>Part Image</Label>
                <div className="mt-1">
                  {form.image_url ? (
                    <div className="relative w-32 h-32">
                      <img 
                        src={form.image_url} 
                        alt="Part"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 bg-white/80"
                        onClick={() => setForm({ ...form, image_url: '' })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                      ) : (
                        <Upload className="w-6 h-6 text-slate-400" />
                      )}
                    </label>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <Label className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Required Operations (in order)
                </Label>
                <p className="text-xs text-slate-500 mb-2">Select operations this part must go through</p>
                
                {form.required_operations.length > 0 && (
                  <div className="space-y-2 mb-3 p-3 bg-slate-50 rounded-lg">
                    {form.required_operations.map((opId, index) => {
                      const op = operations.find(o => o.id === opId);
                      return (
                        <div key={opId} className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                          <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm font-medium">{op?.operation_name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveOperationUp(index)} disabled={index === 0}>
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveOperationDown(index)} disabled={index === form.required_operations.length - 1}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => toggleOperation(opId)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {operations.filter(op => !form.required_operations.includes(op.id)).map((op) => (
                    <Button
                      key={op.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleOperation(op.id)}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {op.operation_name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <Label>Required Fixings</Label>
                <p className="text-xs text-slate-500 mb-2">Consumables needed per unit</p>
                
                {form.required_fixings.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {form.required_fixings.map((rf, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <Select value={rf.fixing_id} onValueChange={(v) => updateFixing(index, 'fixing_id', v)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select fixing..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fixings.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.fixing_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={rf.quantity_per_unit}
                          onChange={(e) => updateFixing(index, 'quantity_per_unit', parseFloat(e.target.value) || 0)}
                          placeholder="Qty"
                          className="w-20"
                          min="0"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeFixing(index)} className="text-red-500">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button type="button" variant="outline" size="sm" onClick={addFixing}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Fixing
                </Button>
              </div>

              <div className="col-span-2 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_rh_variant"
                    checked={form.is_rh_variant}
                    onChange={(e) => setForm({ ...form, is_rh_variant: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <Label htmlFor="is_rh_variant" className="cursor-pointer font-medium">
                    This is a Right Hand (RH) Variant
                  </Label>
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  Check this if this part is specifically a Right Hand variant (for use in sym-opp blanks)
                </p>
              </div>

              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <>
                  <div className="col-span-2 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allow_sym_opp"
                        checked={form.allow_sym_opp}
                        onChange={(e) => setForm({ ...form, allow_sym_opp: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <Label htmlFor="allow_sym_opp" className="cursor-pointer font-medium">
                        Allow Symmetric Opposite (LH/RH variants)
                      </Label>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 ml-6">
                      Check if this blank part can be processed into Left Hand (LH) or Right Hand (RH) version
                    </p>
                  </div>

                  {form.allow_sym_opp && (
                    <>
                      <div className="col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Left Hand (LH) Variant</p>
                        <p className="text-xs text-blue-700">
                          LH will use this blank's part number and name: <span className="font-bold">{form.part_number || '[Part Number]'}</span>
                        </p>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-green-700 font-semibold">RH Variant (Right Hand)</Label>
                        <p className="text-xs text-slate-500 mb-2">Select which RH part to use when processing this blank as RH</p>
                        <Select 
                          value={form.rh_part_id} 
                          onValueChange={(v) => {
                            const selectedPart = parts.find(p => p.id === v);
                            setForm({ 
                              ...form, 
                              rh_part_id: v,
                              rh_part_number: selectedPart?.part_number || '',
                              rh_part_name: selectedPart?.part_name || ''
                            });
                          }}
                        >
                          <SelectTrigger className="mt-1" style={{ borderColor: '#10B981', borderWidth: '2px' }}>
                            <SelectValue placeholder="Select RH part..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parts
                              .filter(p => 
                                p.is_rh_variant || 
                                p.part_name?.toUpperCase().includes('RH') || 
                                p.part_name?.toUpperCase().includes('RHD') ||
                                p.part_number?.toUpperCase().includes('RH') ||
                                p.part_number?.toUpperCase().includes('RHD')
                              )
                              .sort((a, b) => {
                                // Force ascending: project_num → module_letter (A→Z) → part_seq
                                const projA = a.project_num ?? 0;
                                const projB = b.project_num ?? 0;
                                if (projA !== projB) return projA - projB;
                                
                                const modA = (a.module_letter || '').toUpperCase();
                                const modB = (b.module_letter || '').toUpperCase();
                                if (modA < modB) return -1;
                                if (modA > modB) return 1;
                                
                                const seqA = a.part_seq ?? 0;
                                const seqB = b.part_seq ?? 0;
                                return seqA - seqB;
                              })
                              .map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.part_number} - {p.part_name}
                                  {p.is_rh_variant && <span className="ml-2 text-xs text-green-600">[RH]</span>}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {form.rh_part_id && (
                          <p className="text-xs text-green-700 mt-2">
                            Selected: <span className="font-bold">{form.rh_part_number} - {form.rh_part_name}</span>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={savePart} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {editingPart ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPart?.part_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deletePart} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}