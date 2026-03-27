import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, Ruler, ChevronDown, ChevronRight, PlusCircle, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function BarStock() {
  const [barStocks, setBarStocks] = useState([]);
  const [billets, setBillets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBar, setExpandedBar] = useState(null);

  // Bar Stock dialogs
  const [showBarDialog, setShowBarDialog] = useState(false);
  const [editingBar, setEditingBar] = useState(null);
  const [barForm, setBarForm] = useState({ name: '', thickness_mm: '', height_mm: '', default_kerf_mm: '3', min_stock_level_mm: '', description: '', notes: '' });

  // Billet dialogs
  const [showBilletDialog, setShowBilletDialog] = useState(false);
  const [selectedBarForBillet, setSelectedBarForBillet] = useState(null);
  const [editingBillet, setEditingBillet] = useState(null);
  const [billetForm, setBilletForm] = useState({ original_length_mm: '', location: '', notes: '', received_date: '' });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [bs, bil] = await Promise.all([
      base44.entities.BarStock.list('-created_date'),
      base44.entities.BarBillet.list('-created_date'),
    ]);
    setBarStocks(bs);
    setBillets(bil);
    setLoading(false);
  };

  const getBilletsForBar = (barId) => billets.filter(b => b.bar_stock_id === barId);

  const getTotalRemaining = (barId) =>
    billets.filter(b => b.bar_stock_id === barId && b.status === 'active')
      .reduce((sum, b) => sum + (b.remaining_mm || 0), 0);

  // ---- Bar Stock CRUD ----
  const openNewBar = () => {
    setEditingBar(null);
    setBarForm({ name: '', thickness_mm: '', height_mm: '', default_kerf_mm: '3', min_stock_level_mm: '', description: '', notes: '' });
    setShowBarDialog(true);
  };

  const openEditBar = (bar) => {
    setEditingBar(bar);
    setBarForm({
      name: bar.name || '',
      thickness_mm: bar.thickness_mm || '',
      height_mm: bar.height_mm || '',
      default_kerf_mm: bar.default_kerf_mm ?? 3,
      min_stock_level_mm: bar.min_stock_level_mm ?? '',
      description: bar.description || '',
      notes: bar.notes || '',
    });
    setShowBarDialog(true);
  };

  const saveBar = async () => {
    if (!barForm.name || !barForm.thickness_mm || !barForm.height_mm) {
      toast.error('Name, thickness and height are required');
      return;
    }
    setSaving(true);
    const data = {
      name: barForm.name,
      thickness_mm: parseFloat(barForm.thickness_mm),
      height_mm: parseFloat(barForm.height_mm),
      default_kerf_mm: parseFloat(barForm.default_kerf_mm) || 3,
      min_stock_level_mm: barForm.min_stock_level_mm ? parseFloat(barForm.min_stock_level_mm) : null,
      description: barForm.description,
      notes: barForm.notes,
    };
    if (editingBar) {
      await base44.entities.BarStock.update(editingBar.id, data);
      toast.success('Bar stock profile updated');
    } else {
      await base44.entities.BarStock.create({ ...data, total_mm_held: 0 });
      toast.success('Bar stock profile created');
    }
    setSaving(false);
    setShowBarDialog(false);
    loadData();
  };

  const deleteBar = async (bar) => {
    const hasBillets = billets.some(b => b.bar_stock_id === bar.id);
    if (hasBillets) {
      toast.error('Cannot delete — this bar has billets. Delete billets first.');
      return;
    }
    await base44.entities.BarStock.delete(bar.id);
    toast.success('Bar stock profile deleted');
    loadData();
  };

  // ---- Billet CRUD ----
  const openNewBillet = (bar) => {
    setSelectedBarForBillet(bar);
    setEditingBillet(null);
    setBilletForm({ original_length_mm: '', location: '', notes: '', received_date: '' });
    setShowBilletDialog(true);
  };

  const openEditBillet = (billet, bar) => {
    setSelectedBarForBillet(bar);
    setEditingBillet(billet);
    setBilletForm({
      original_length_mm: billet.original_length_mm || '',
      location: billet.location || '',
      notes: billet.notes || '',
      received_date: billet.received_date || '',
    });
    setShowBilletDialog(true);
  };

  const saveBillet = async () => {
    if (!billetForm.original_length_mm) {
      toast.error('Length is required');
      return;
    }
    setSaving(true);
    const len = parseFloat(billetForm.original_length_mm);
    if (editingBillet) {
      await base44.entities.BarBillet.update(editingBillet.id, {
        location: billetForm.location,
        notes: billetForm.notes,
        received_date: billetForm.received_date,
      });
      toast.success('Billet updated');
    } else {
      await base44.entities.BarBillet.create({
        bar_stock_id: selectedBarForBillet.id,
        bar_stock_name: selectedBarForBillet.name,
        original_length_mm: len,
        remaining_mm: len,
        status: 'active',
        location: billetForm.location,
        notes: billetForm.notes,
        received_date: billetForm.received_date || new Date().toISOString().split('T')[0],
      });
      toast.success(`Billet of ${len.toLocaleString()}mm added`);
    }
    setSaving(false);
    setShowBilletDialog(false);
    loadData();
  };

  const deleteBillet = async (billet) => {
    await base44.entities.BarBillet.delete(billet.id);
    toast.success('Billet removed');
    loadData();
  };

  const statusColor = (s) =>
    s === 'active' ? 'bg-green-100 text-green-800' :
    s === 'depleted' ? 'bg-red-100 text-red-800' :
    'bg-yellow-100 text-yellow-800';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bar Stock</h1>
          <p className="text-slate-500 text-sm mt-1">Manage bar profiles and billet inventory</p>
        </div>
        <Button onClick={openNewBar} style={{ backgroundColor: '#3B82F6', color: 'white' }}>
          <Plus className="w-4 h-4 mr-2" />
          New Bar Profile
        </Button>
      </div>

      {/* Low stock alerts */}
      {barStocks.filter(bar => bar.min_stock_level_mm && getTotalRemaining(bar.id) < bar.min_stock_level_mm).length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            Bar Stock Low — Reorder Required
          </div>
          {barStocks
            .filter(bar => bar.min_stock_level_mm && getTotalRemaining(bar.id) < bar.min_stock_level_mm)
            .map(bar => (
              <div key={bar.id} className="flex items-center justify-between text-sm text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                <span className="font-medium">{bar.name}</span>
                <span>{getTotalRemaining(bar.id).toLocaleString()}mm remaining / {bar.min_stock_level_mm.toLocaleString()}mm minimum</span>
              </div>
            ))
          }
        </div>
      )}

      {barStocks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Ruler className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No bar stock profiles yet</p>
            <p className="text-slate-400 text-sm mt-1">Create a profile for each bar section type you hold</p>
            <Button onClick={openNewBar} className="mt-4" style={{ backgroundColor: '#3B82F6', color: 'white' }}>
              <Plus className="w-4 h-4 mr-2" /> Add First Profile
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {barStocks.map(bar => {
          const barBillets = getBilletsForBar(bar.id);
          const totalRemaining = getTotalRemaining(bar.id);
          const activeBillets = barBillets.filter(b => b.status === 'active').length;
          const isExpanded = expandedBar === bar.id;
          const isLowStock = bar.min_stock_level_mm && totalRemaining < bar.min_stock_level_mm;

          return (
            <Card key={bar.id} className={`overflow-hidden ${isLowStock ? 'border-l-4 border-l-amber-500' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedBar(isExpanded ? null : bar.id)}>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{bar.name}</CardTitle>
                      {bar.description && <p className="text-sm text-slate-500 mt-0.5">{bar.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {bar.thickness_mm} × {bar.height_mm} mm</span>
                        <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Kerf: {bar.default_kerf_mm ?? 3}mm</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className={`text-lg font-bold ${isLowStock ? 'text-amber-600' : 'text-slate-800'}`}>
                        {isLowStock && <AlertTriangle className="w-4 h-4 inline mr-1 mb-0.5" />}
                        {totalRemaining.toLocaleString()} mm
                      </p>
                      <p className="text-xs text-slate-500">{activeBillets} active billet{activeBillets !== 1 ? 's' : ''}</p>
                      {bar.min_stock_level_mm && (
                        <p className={`text-xs ${isLowStock ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                          Min: {bar.min_stock_level_mm.toLocaleString()}mm
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openEditBar(bar)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteBar(bar)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-700">Billets ({barBillets.length})</h3>
                      <Button size="sm" onClick={() => openNewBillet(bar)} style={{ backgroundColor: '#10B981', color: 'white' }}>
                        <PlusCircle className="w-4 h-4 mr-1" /> Add Billet
                      </Button>
                    </div>

                    {barBillets.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">No billets added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {barBillets.map(billet => {
                          const pct = billet.original_length_mm > 0
                            ? Math.round((billet.remaining_mm / billet.original_length_mm) * 100)
                            : 0;
                          return (
                            <div key={billet.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-700">{(billet.remaining_mm || 0).toLocaleString()} mm remaining</span>
                                  <span className="text-xs text-slate-400">of {(billet.original_length_mm || 0).toLocaleString()} mm</span>
                                  <Badge className={`text-xs ${statusColor(billet.status)}`}>{billet.status}</Badge>
                                </div>
                                <div className="mt-1.5 h-2 bg-slate-200 rounded-full overflow-hidden w-full max-w-xs">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, backgroundColor: pct > 25 ? '#10B981' : pct > 10 ? '#F59E0B' : '#EF4444' }}
                                  />
                                </div>
                                <div className="flex gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                                  {billet.location && <span>📍 {billet.location}</span>}
                                  {billet.received_date && <span>Received: {format(new Date(billet.received_date), 'dd/MM/yyyy')}</span>}
                                  <span>{pct}% remaining</span>
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => openEditBillet(billet, bar)}><Pencil className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteBillet(billet)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bar Stock Dialog */}
      <Dialog open={showBarDialog} onOpenChange={setShowBarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBar ? 'Edit Bar Profile' : 'New Bar Stock Profile'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Profile Name *</Label>
              <Input placeholder="e.g. 50x25 Flat Bar, 60x60 SHS" value={barForm.name} onChange={e => setBarForm({ ...barForm, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Thickness (mm) *</Label>
                <Input type="number" placeholder="e.g. 50" value={barForm.thickness_mm} onChange={e => setBarForm({ ...barForm, thickness_mm: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Height (mm) *</Label>
                <Input type="number" placeholder="e.g. 25" value={barForm.height_mm} onChange={e => setBarForm({ ...barForm, height_mm: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Default Kerf (mm)</Label>
                <Input type="number" placeholder="3" value={barForm.default_kerf_mm} onChange={e => setBarForm({ ...barForm, default_kerf_mm: e.target.value })} className="mt-1" />
                <p className="text-xs text-slate-400 mt-1">Saw blade cut thickness</p>
              </div>
              <div>
                <Label>Min Stock Level (mm)</Label>
                <Input type="number" placeholder="e.g. 5000" value={barForm.min_stock_level_mm} onChange={e => setBarForm({ ...barForm, min_stock_level_mm: e.target.value })} className="mt-1" />
                <p className="text-xs text-slate-400 mt-1">Alert when total remaining drops below this</p>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Material type, grade, etc." value={barForm.description} onChange={e => setBarForm({ ...barForm, description: e.target.value })} className="mt-1 h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBarDialog(false)}>Cancel</Button>
            <Button onClick={saveBar} disabled={saving} style={{ backgroundColor: '#3B82F6', color: 'white' }}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBar ? 'Update' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billet Dialog */}
      <Dialog open={showBilletDialog} onOpenChange={setShowBilletDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBillet ? 'Edit Billet' : `Add Billet — ${selectedBarForBillet?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingBillet && (
              <div>
                <Label>Length (mm) *</Label>
                <Input type="number" placeholder="e.g. 7500" value={billetForm.original_length_mm} onChange={e => setBilletForm({ ...billetForm, original_length_mm: e.target.value })} className="mt-1" />
                <p className="text-xs text-slate-400 mt-1">Full length of this billet/bar in mm</p>
              </div>
            )}
            <div>
              <Label>Storage Location</Label>
              <Input placeholder="e.g. Rack A3, Bay 2" value={billetForm.location} onChange={e => setBilletForm({ ...billetForm, location: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Received Date</Label>
              <Input type="date" value={billetForm.received_date} onChange={e => setBilletForm({ ...billetForm, received_date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Any notes..." value={billetForm.notes} onChange={e => setBilletForm({ ...billetForm, notes: e.target.value })} className="mt-1 h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBilletDialog(false)}>Cancel</Button>
            <Button onClick={saveBillet} disabled={saving} style={{ backgroundColor: '#10B981', color: 'white' }}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBillet ? 'Update Billet' : 'Add Billet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}