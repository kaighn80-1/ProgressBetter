import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Printer, 
  Download,
  CheckCircle2,
  Clock,
  Send,
  Package,
  MapPin,
  Calendar,
  ArrowRight,
  Loader2,
  Trash2,
  Eye,
  Search,
  Filter,
  X
} from 'lucide-react';
import { format } from 'date-fns';

export default function DeliveryNotes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [user, setUser] = useState(null);
  
  // Create form state
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [parts, setParts] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [customAddress, setCustomAddress] = useState({
    address_name: '',
    full_address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: ''
  });
  const [selectedItems, setSelectedItems] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState('assembly');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, notesData, projectsData, addressesData, partsData, assembliesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.DeliveryNote.list('-delivery_date'),
        base44.entities.Project.list(),
        base44.entities.DeliveryAddress.list(),
        base44.entities.Part.list(),
        base44.entities.Assembly.list()
      ]);
      setUser(userData);
      setDeliveryNotes(notesData);
      setProjects(projectsData);
      setAddresses(addressesData);
      setParts(partsData);
      setAssemblies(assembliesData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredNotes = () => {
    let filtered = deliveryNotes;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note => {
        const searchFields = [
          note.delivery_note_number,
          note.project_name,
          note.delivery_address_name,
          note.selected_parts?.map(p => p.part_number || p.assembly_number).join(' ')
        ].join(' ').toLowerCase();
        
        return searchFields.includes(query);
      });
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.delivery_date);
        
        if (dateFilter === 'today') {
          return noteDate >= today && noteDate < new Date(today.getTime() + 86400000);
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today.getTime() - 7 * 86400000);
          return noteDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today.getTime() - 30 * 86400000);
          return noteDate >= monthAgo;
        }
        return true;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(note => note.status === statusFilter);
    }

    return filtered;
  };

  const filteredNotes = getFilteredNotes();

  const calculateAssemblyAvailableQty = (assembly) => {
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

  const getEligibleAssemblies = () => {
    return assemblies.filter(a => calculateAssemblyAvailableQty(a) > 0).sort((a, b) => calculateAssemblyAvailableQty(b) - calculateAssemblyAvailableQty(a));
  };

  const getEligibleParts = () => {
    if (!selectedProject) return [];
    return parts.filter(p => 
      p.project_id === selectedProject && 
      !p.parent_assembly_id &&
      (p.finished_stock || 0) > 0
    );
  };

  const handleQuantityChange = (id, quantity) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: parseInt(quantity) || 0
    }));
  };

  const generateDeliveryNoteNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `DN-${year}${month}-${random}`;
  };

  const handleCreateDeliveryNote = async () => {
    // Validation
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    let itemsToDeliver = [];

    if (deliveryMode === 'assembly') {
      itemsToDeliver = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([assemblyId, qty]) => {
          const assembly = assemblies.find(a => a.id === assemblyId);
          return {
            type: 'assembly',
            assembly_id: assemblyId,
            assembly_number: assembly.assembly_number,
            assembly_name: assembly.assembly_name,
            quantity: qty,
            required_parts: assembly.required_parts || []
          };
        });
    } else {
      itemsToDeliver = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([partId, qty]) => {
          const part = parts.find(p => p.id === partId);
          return {
            type: 'part',
            part_id: partId,
            part_name: part.part_name,
            part_number: part.part_number,
            quantity: qty,
            unit: part.unit || 'pcs'
          };
        });
    }

    if (itemsToDeliver.length === 0) {
      toast.error(`Please select at least one ${deliveryMode === 'assembly' ? 'assembly' : 'part'} with quantity`);
      return;
    }

    let addressInfo = {};
    if (useCustomAddress) {
      if (!customAddress.address_name || !customAddress.full_address) {
        toast.error('Please fill in address details');
        return;
      }
      try {
        const newAddr = await base44.entities.DeliveryAddress.create(customAddress);
        addressInfo = {
          delivery_address_id: newAddr.id,
          delivery_address_name: newAddr.address_name,
          delivery_address_full: newAddr.full_address,
          delivery_contact: `${newAddr.contact_name || ''} ${newAddr.contact_phone || ''} ${newAddr.contact_email || ''}`.trim()
        };
      } catch (e) {
        toast.error('Failed to save address');
        return;
      }
    } else {
      const addr = addresses.find(a => a.id === selectedAddress);
      if (addr) {
        addressInfo = {
          delivery_address_id: addr.id,
          delivery_address_name: addr.address_name,
          delivery_address_full: addr.full_address,
          delivery_contact: `${addr.contact_name || ''} ${addr.contact_phone || ''} ${addr.contact_email || ''}`.trim()
        };
      } else {
        const defaultAddr = addresses.find(a => a.is_default);
        if (defaultAddr) {
          addressInfo = {
            delivery_address_id: defaultAddr.id,
            delivery_address_name: defaultAddr.address_name,
            delivery_address_full: defaultAddr.full_address,
            delivery_contact: `${defaultAddr.contact_name || ''} ${defaultAddr.contact_phone || ''} ${defaultAddr.contact_email || ''}`.trim()
          };
        }
      }
    }

    setSaving(true);
    try {
      const project = projects.find(p => p.id === selectedProject);
      const totalQty = itemsToDeliver.reduce((sum, item) => sum + item.quantity, 0);
      
      const deliveryNote = await base44.entities.DeliveryNote.create({
        delivery_note_number: generateDeliveryNoteNumber(),
        project_id: selectedProject,
        project_name: project?.project_name,
        delivery_date: deliveryDate,
        ...addressInfo,
        selected_parts: itemsToDeliver,
        total_quantity: totalQty,
        notes: notes,
        generated_by_email: user?.email,
        generated_by_name: user?.full_name,
        status: 'generated'
      });

      // Handle assembly deliveries - deduct from child parts proportionally
      if (deliveryMode === 'assembly') {
        for (const item of itemsToDeliver) {
          const assembly = assemblies.find(a => a.id === item.assembly_id);
          
          if (assembly.required_parts && assembly.required_parts.length > 0) {
            for (const req of assembly.required_parts) {
              const part = parts.find(p => p.id === req.part_id);
              if (part) {
                const qtyToDeduct = item.quantity * req.quantity_needed;
                const newStock = Math.max(0, (part.finished_stock || 0) - qtyToDeduct);
                await base44.entities.Part.update(req.part_id, {
                  finished_stock: newStock
                });

                await base44.entities.StockTransaction.create({
                  part_id: req.part_id,
                  part_name: req.part_name,
                  transaction_type: 'delivered',
                  quantity_change: -qtyToDeduct,
                  user_email: user?.email,
                  user_name: user?.full_name,
                  notes: `Delivery Note: ${deliveryNote.delivery_note_number} (Assembly: ${item.assembly_number})`
                });
              }
            }
          }

          await base44.entities.StockTransaction.create({
            part_id: item.assembly_id,
            part_name: item.assembly_name,
            transaction_type: 'delivered',
            quantity_change: -item.quantity,
            user_email: user?.email,
            user_name: user?.full_name,
            notes: `Delivery Note: ${deliveryNote.delivery_note_number} (Assembly)`
          });
        }
      } else {
        // Handle part deliveries
        for (const item of itemsToDeliver) {
          const part = parts.find(p => p.id === item.part_id);
          await base44.entities.Part.update(item.part_id, {
            finished_stock: Math.max(0, (part.finished_stock || 0) - item.quantity)
          });

          await base44.entities.StockTransaction.create({
            part_id: item.part_id,
            part_name: item.part_name,
            transaction_type: 'delivered',
            quantity_change: -item.quantity,
            user_email: user?.email,
            user_name: user?.full_name,
            notes: `Delivery Note: ${deliveryNote.delivery_note_number}`
          });
        }
      }

      toast.success('Delivery note generated successfully!');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate delivery note');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedProject('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setSelectedAddress('');
    setUseCustomAddress(false);
    setCustomAddress({
      address_name: '',
      full_address: '',
      contact_name: '',
      contact_phone: '',
      contact_email: ''
    });
    setSelectedItems({});
    setNotes('');
    setDeliveryMode('assembly');
  };

  const handleMarkAsSent = async (noteId) => {
    try {
      await base44.entities.DeliveryNote.update(noteId, { status: 'sent' });
      toast.success('Marked as sent');
      loadData();
      setShowViewDialog(false);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: { bg: '#F1F5F9', color: '#64748B' },
      generated: { bg: '#DBEAFE', color: '#1E40AF' },
      sent: { bg: '#D1FAE5', color: '#065F46' },
      delivered: { bg: '#D1FAE5', color: '#065F46' }
    };
    const style = styles[status] || styles.draft;
    return (
      <Badge style={{ backgroundColor: style.bg, color: style.color }}>
        {status === 'draft' && <Clock className="w-3 h-3 mr-1" />}
        {status === 'generated' && <FileText className="w-3 h-3 mr-1" />}
        {(status === 'sent' || status === 'delivered') && <CheckCircle2 className="w-3 h-3 mr-1" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1E293B' }}>Delivery Notes</h1>
          <p style={{ color: '#64748B' }}>Manage part deliveries and shipments</p>
        </div>
        <Button 
          size="lg" 
          onClick={() => setShowCreateDialog(true)}
          style={{ backgroundColor: '#3B82F6', color: 'white' }}
          className="hover:opacity-90"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Delivery Note
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <Label className="text-sm font-semibold mb-2 block" style={{ color: '#1E293B' }}>
                Search Delivery Notes
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#94A3B8' }} />
                  <Input
                    placeholder="Search by note #, date, project, address, or part number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1 top-1/2 transform -translate-y-1/2"
                      style={{ color: '#94A3B8' }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40 h-10">
                  <SelectValue placeholder="Date filter..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-10">
                  <SelectValue placeholder="Status filter..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="generated">Generated</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>

              {(searchQuery || dateFilter !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('all');
                    setStatusFilter('all');
                  }}
                  style={{ color: '#64748B' }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear Filters
                </Button>
              )}

              <div className="ml-auto">
                <Badge variant="outline" className="text-sm font-semibold" style={{ color: '#3B82F6', borderColor: '#3B82F6' }}>
                  {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Notes List */}
      {deliveryNotes.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: '#CBD5E1' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E293B' }}>No delivery notes yet</h3>
            <p className="mb-6" style={{ color: '#64748B' }}>Create your first delivery note to start tracking shipments</p>
            <Button onClick={() => setShowCreateDialog(true)} style={{ backgroundColor: '#3B82F6', color: 'white' }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Delivery Note
            </Button>
          </CardContent>
        </Card>
      ) : filteredNotes.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 mx-auto mb-4" style={{ color: '#CBD5E1' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E293B' }}>No delivery notes found</h3>
            <p className="mb-4" style={{ color: '#64748B' }}>
              {searchQuery || dateFilter !== 'all' || statusFilter !== 'all' 
                ? 'No delivery notes match your search criteria. Try adjusting your filters.'
                : 'No delivery notes to display.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(createPageUrl('DeliveryNoteDetail') + `?id=${note.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-5 h-5" style={{ color: '#3B82F6' }} />
                      <h3 className="font-bold text-lg" style={{ color: '#1E293B' }}>{note.delivery_note_number}</h3>
                    </div>
                    <p className="text-sm" style={{ color: '#64748B' }}>{note.project_name}</p>
                  </div>
                  {getStatusBadge(note.status)}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p style={{ color: '#64748B' }} className="text-xs mb-1">Delivery Date</p>
                    <p className="font-medium flex items-center gap-1" style={{ color: '#1E293B' }}>
                      <Calendar className="w-3 h-3" />
                      {format(new Date(note.delivery_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#64748B' }} className="text-xs mb-1">Total Items</p>
                    <p className="font-medium flex items-center gap-1" style={{ color: '#1E293B' }}>
                      <Package className="w-3 h-3" />
                      {note.selected_parts?.length || 0} items
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#64748B' }} className="text-xs mb-1">Total Quantity</p>
                    <p className="font-bold" style={{ color: '#10B981' }}>
                      {note.total_quantity || 0}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#64748B' }} className="text-xs mb-1">Destination</p>
                    <p className="font-medium flex items-center gap-1 truncate" style={{ color: '#1E293B' }}>
                      <MapPin className="w-3 h-3" />
                      {note.delivery_address_name || 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Delivery Note - Step {step} of 3</DialogTitle>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Select Project *</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="h-12 mt-1">
                    <SelectValue placeholder="Choose project..." />
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
                <Label>Delivery Date *</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="h-12 mt-1"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setDeliveryMode('assembly')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    deliveryMode === 'assembly'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  Assemblies
                </button>
                <button
                  onClick={() => setDeliveryMode('part')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    deliveryMode === 'part'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  Individual Parts
                </button>
              </div>

              {deliveryMode === 'assembly' ? (
                <>
                  <h3 className="font-semibold" style={{ color: '#1E293B' }}>Select Assemblies to Deliver</h3>
                  {getEligibleAssemblies().length === 0 ? (
                    <p style={{ color: '#64748B' }}>No assemblies with available quantity.</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {getEligibleAssemblies().map((assembly) => {
                        const availableQty = calculateAssemblyAvailableQty(assembly);
                        return (
                          <div key={assembly.id} className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-bold" style={{ color: '#1E293B' }}>{assembly.assembly_number}</p>
                                <p className="text-sm font-medium" style={{ color: '#64748B' }}>{assembly.assembly_name}</p>
                              </div>
                              <Badge style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                Available: {availableQty}
                              </Badge>
                            </div>
                            
                            {assembly.required_parts && assembly.required_parts.length > 0 && (
                              <div className="mb-3 p-2 bg-white rounded" style={{ borderLeft: '3px solid #3B82F6' }}>
                                <p className="text-xs font-semibold text-slate-600 mb-2">Required Parts:</p>
                                {assembly.required_parts.map((req, idx) => (
                                  <p key={idx} className="text-xs text-slate-600">• {req.part_number} - {req.part_name} (qty: {req.quantity_needed})</p>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Qty to deliver:</Label>
                              <Input
                                type="number"
                                min="0"
                                max={availableQty}
                                value={selectedItems[assembly.id] || ''}
                                onChange={(e) => handleQuantityChange(assembly.id, e.target.value)}
                                placeholder="0"
                                className="h-10 w-24"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-semibold" style={{ color: '#1E293B' }}>Select Individual Parts to Deliver</h3>
                  {getEligibleParts().length === 0 ? (
                    <p style={{ color: '#64748B' }}>No completed parts available for this project.</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {getEligibleParts()
                        .sort((a, b) => {
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
                        .map((part) => (
                        <div key={part.id} className="p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold" style={{ color: '#1E293B' }}>{part.part_number}</p>
                              <p className="text-xs font-medium" style={{ color: '#64748B' }}>{part.part_name}</p>
                            </div>
                            <Badge style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                              Available: {part.finished_stock || 0}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Qty to deliver:</Label>
                            <Input
                              type="number"
                              min="0"
                              max={part.finished_stock || 0}
                              value={selectedItems[part.id] || ''}
                              onChange={(e) => handleQuantityChange(part.id, e.target.value)}
                              placeholder="0"
                              className="h-10 w-24"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="customAddr"
                  checked={useCustomAddress}
                  onChange={(e) => setUseCustomAddress(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="customAddr" className="cursor-pointer">Use custom address</Label>
              </div>

              {useCustomAddress ? (
                <div className="space-y-3">
                  <div>
                    <Label>Address Name/Label *</Label>
                    <Input
                      value={customAddress.address_name}
                      onChange={(e) => setCustomAddress({ ...customAddress, address_name: e.target.value })}
                      placeholder="e.g., Customer A - Warehouse 1"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Full Address *</Label>
                    <Textarea
                      value={customAddress.full_address}
                      onChange={(e) => setCustomAddress({ ...customAddress, full_address: e.target.value })}
                      placeholder="Street, City, ZIP, Country"
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Contact Name</Label>
                      <Input
                        value={customAddress.contact_name}
                        onChange={(e) => setCustomAddress({ ...customAddress, contact_name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Contact Phone</Label>
                      <Input
                        value={customAddress.contact_phone}
                        onChange={(e) => setCustomAddress({ ...customAddress, contact_phone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Delivery Address</Label>
                  <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                    <SelectTrigger className="h-12 mt-1">
                      <SelectValue placeholder="Select saved address..." />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.address_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <div className="flex gap-2 justify-between w-full">
              <div className="flex gap-2">
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                {step < 3 ? (
                  <Button onClick={() => setStep(step + 1)} style={{ backgroundColor: '#3B82F6', color: 'white' }}>
                    Next
                  </Button>
                ) : (
                  <Button onClick={handleCreateDeliveryNote} disabled={saving} style={{ backgroundColor: '#3B82F6', color: 'white' }}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Delivery Note'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}