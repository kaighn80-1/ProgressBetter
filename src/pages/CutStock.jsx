import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Scissors, Ruler, Package, History, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CutStock() {
  const [user, setUser] = useState(null);
  const [barStocks, setBarStocks] = useState([]);
  const [billets, setBillets] = useState([]);
  const [parts, setParts] = useState([]);
  const [cutLogs, setCutLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cut form state
  const [selectedBar, setSelectedBar] = useState(null);
  const [selectedBillet, setSelectedBillet] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [cutForm, setCutForm] = useState({ quantity: '', mm_per_part: '', kerf_mm: '', notes: '' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('cut'); // 'cut' | 'history'

  useEffect(() => {
    loadData();
  }, []);

  // Auto-fill kerf from bar profile
  useEffect(() => {
    if (selectedBar) {
      setCutForm(f => ({ ...f, kerf_mm: selectedBar.default_kerf_mm ?? 3 }));
    }
  }, [selectedBar]);

  // Auto-fill mm_per_part from part if set
  useEffect(() => {
    if (selectedPart?.bar_mm_per_part) {
      setCutForm(f => ({ ...f, mm_per_part: selectedPart.bar_mm_per_part }));
    }
  }, [selectedPart]);

  const loadData = async () => {
    setLoading(true);
    const [bs, bil, prt, cl, userData] = await Promise.all([
      base44.entities.BarStock.list('-created_date'),
      base44.entities.BarBillet.list('-created_date'),
      base44.entities.Part.list(),
      base44.entities.BarCutLog.list('-created_date', 50),
      base44.auth.me(),
    ]);
    setBarStocks(bs);
    setBillets(bil);
    setParts(prt);
    setCutLogs(cl);
    setUser(userData);
    setLoading(false);
  };

  const activeBilletsForBar = (barId) =>
    billets.filter(b => b.bar_stock_id === barId && b.status === 'active')
      .sort((a, b) => a.remaining_mm - b.remaining_mm); // show shortest first (use offcuts first)

  const mmPerCut = () => {
    const mm = parseFloat(cutForm.mm_per_part) || 0;
    const kerf = parseFloat(cutForm.kerf_mm) || 0;
    return mm + kerf;
  };

  const totalMmNeeded = () => mmPerCut() * (parseInt(cutForm.quantity) || 0);

  const canCut = () => selectedBillet && totalMmNeeded() > 0 && totalMmNeeded() <= selectedBillet.remaining_mm;

  const handleCutClick = () => {
    if (!selectedBar) { toast.error('Select a bar profile'); return; }
    if (!selectedBillet) { toast.error('Select a billet'); return; }
    if (!selectedPart) { toast.error('Select a part'); return; }
    if (!cutForm.quantity || parseInt(cutForm.quantity) < 1) { toast.error('Enter quantity'); return; }
    if (!cutForm.mm_per_part || parseFloat(cutForm.mm_per_part) <= 0) { toast.error('Enter mm per part'); return; }
    if (totalMmNeeded() > selectedBillet.remaining_mm) {
      toast.error(`Not enough bar: need ${totalMmNeeded().toLocaleString()}mm, have ${selectedBillet.remaining_mm.toLocaleString()}mm`);
      return;
    }
    setShowConfirm(true);
  };

  const executeCut = async () => {
    setSaving(true);
    const qty = parseInt(cutForm.quantity);
    const mmPerPart = parseFloat(cutForm.mm_per_part);
    const kerf = parseFloat(cutForm.kerf_mm) || 0;
    const totalUsed = (mmPerPart + kerf) * qty;
    const mmBefore = selectedBillet.remaining_mm;
    const mmAfter = mmBefore - totalUsed;

    // Update billet remaining
    await base44.entities.BarBillet.update(selectedBillet.id, {
      remaining_mm: mmAfter,
      status: mmAfter <= 0 ? 'depleted' : 'active',
    });

    // Log the cut
    await base44.entities.BarCutLog.create({
      bar_billet_id: selectedBillet.id,
      bar_stock_id: selectedBar.id,
      bar_stock_name: selectedBar.name,
      part_id: selectedPart.id,
      part_name: selectedPart.part_name,
      part_number: selectedPart.part_number,
      quantity_cut: qty,
      mm_per_part: mmPerPart,
      kerf_mm: kerf,
      total_mm_used: totalUsed,
      mm_before: mmBefore,
      mm_after: mmAfter,
      user_email: user?.email,
      user_name: user?.full_name,
      notes: cutForm.notes,
    });

    // Add to part raw stock
    const currentRaw = selectedPart.raw_stock || 0;
    await base44.entities.Part.update(selectedPart.id, {
      raw_stock: currentRaw + qty,
    });

    // Stock transaction log
    await base44.entities.StockTransaction.create({
      part_id: selectedPart.id,
      part_name: selectedPart.part_name,
      transaction_type: 'received_raw_stock',
      quantity_change: qty,
      user_email: user?.email,
      user_name: user?.full_name,
      notes: `Cut from ${selectedBar.name} billet — ${totalUsed.toLocaleString()}mm used (${mmPerPart}mm + ${kerf}mm kerf × ${qty} parts)`,
    });

    toast.success(`✅ ${qty} × ${selectedPart.part_name} cut — ${totalUsed.toLocaleString()}mm used, ${mmAfter.toLocaleString()}mm remaining`);
    setSaving(false);
    setShowConfirm(false);

    // Reset cut form but keep bar/billet selection
    setCutForm({ quantity: '', mm_per_part: selectedPart?.bar_mm_per_part || '', kerf_mm: selectedBar?.default_kerf_mm ?? 3, notes: '' });
    setSelectedPart(null);
    loadData();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cut Stock</h1>
          <p className="text-slate-500 text-sm mt-1">Record parts cut from bar stock — updates raw stock automatically</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === 'cut' ? 'default' : 'outline'} onClick={() => setActiveTab('cut')} style={activeTab === 'cut' ? { backgroundColor: '#3B82F6', color: 'white' } : {}}>
            <Scissors className="w-4 h-4 mr-2" /> Cut Parts
          </Button>
          <Button variant={activeTab === 'history' ? 'default' : 'outline'} onClick={() => setActiveTab('history')} style={activeTab === 'history' ? { backgroundColor: '#3B82F6', color: 'white' } : {}}>
            <History className="w-4 h-4 mr-2" /> History
          </Button>
        </div>
      </div>

      {activeTab === 'cut' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step 1: Select Bar Profile */}
          <Card className={`border-2 ${selectedBar ? 'border-blue-300' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">1</span>
                Select Bar Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {barStocks.length === 0 && <p className="text-sm text-slate-400">No bar profiles — add them in Bar Stock first.</p>}
              {barStocks.map(bar => {
                const active = activeBilletsForBar(bar.id);
                const totalMm = active.reduce((s, b) => s + b.remaining_mm, 0);
                return (
                  <button
                    key={bar.id}
                    onClick={() => { setSelectedBar(bar); setSelectedBillet(null); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${selectedBar?.id === bar.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 bg-white'}`}
                  >
                    <p className="font-medium text-sm text-slate-800">{bar.name}</p>
                    <p className="text-xs text-slate-500">{bar.thickness_mm}×{bar.height_mm}mm · {active.length} billet{active.length !== 1 ? 's' : ''} · {totalMm.toLocaleString()}mm</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Step 2: Select Billet */}
          <Card className={`border-2 ${selectedBillet ? 'border-green-300' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">2</span>
                Select Billet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedBar && <p className="text-sm text-slate-400">Select a bar profile first</p>}
              {selectedBar && activeBilletsForBar(selectedBar.id).length === 0 && (
                <p className="text-sm text-slate-400">No active billets for this profile</p>
              )}
              {selectedBar && activeBilletsForBar(selectedBar.id).map(billet => {
                const pct = Math.round((billet.remaining_mm / billet.original_length_mm) * 100);
                return (
                  <button
                    key={billet.id}
                    onClick={() => setSelectedBillet(billet)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${selectedBillet?.id === billet.id ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-green-300 bg-white'}`}
                  >
                    <p className="font-medium text-sm text-slate-800">{billet.remaining_mm.toLocaleString()} mm remaining</p>
                    <p className="text-xs text-slate-500">of {billet.original_length_mm.toLocaleString()}mm · {pct}%</p>
                    <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 25 ? '#10B981' : pct > 10 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    {billet.location && <p className="text-xs text-slate-400 mt-1">📍 {billet.location}</p>}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Step 3: Cut Details */}
          <Card className={`border-2 ${selectedPart && canCut() ? 'border-amber-300' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">3</span>
                Cut Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Part to Cut</Label>
                <Select
                  value={selectedPart?.id || ''}
                  onValueChange={id => setSelectedPart(parts.find(p => p.id === id) || null)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select part..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parts.filter(p => p.bar_stock_id === selectedBar?.id || !p.bar_stock_id).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.part_number} — {p.part_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min="1" placeholder="e.g. 10" value={cutForm.quantity} onChange={e => setCutForm({ ...cutForm, quantity: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>mm per Part</Label>
                  <Input type="number" min="1" placeholder="e.g. 300" value={cutForm.mm_per_part} onChange={e => setCutForm({ ...cutForm, mm_per_part: e.target.value })} className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Kerf (mm per cut)</Label>
                <Input type="number" min="0" step="0.5" placeholder="3" value={cutForm.kerf_mm} onChange={e => setCutForm({ ...cutForm, kerf_mm: e.target.value })} className="mt-1" />
              </div>

              {/* Live calculation */}
              {cutForm.quantity && cutForm.mm_per_part && (
                <div className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: '#F0FDF4' }}>
                  <p className="font-medium text-green-800">Cut Summary</p>
                  <p className="text-green-700">{cutForm.mm_per_part}mm + {cutForm.kerf_mm || 0}mm kerf = <strong>{mmPerCut()}mm per cut</strong></p>
                  <p className="text-green-700">× {cutForm.quantity} parts = <strong>{totalMmNeeded().toLocaleString()}mm total</strong></p>
                  {selectedBillet && (
                    <p className={`font-semibold ${totalMmNeeded() > selectedBillet.remaining_mm ? 'text-red-600' : 'text-green-800'}`}>
                      {totalMmNeeded() > selectedBillet.remaining_mm
                        ? `⚠ Short by ${(totalMmNeeded() - selectedBillet.remaining_mm).toLocaleString()}mm`
                        : `✓ ${(selectedBillet.remaining_mm - totalMmNeeded()).toLocaleString()}mm will remain`
                      }
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Any notes..." value={cutForm.notes} onChange={e => setCutForm({ ...cutForm, notes: e.target.value })} className="mt-1 h-16" />
              </div>

              <Button
                className="w-full"
                onClick={handleCutClick}
                disabled={!selectedBillet || !selectedPart}
                style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}
              >
                <Scissors className="w-4 h-4 mr-2" />
                Record Cut & Add to Raw Stock
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Cut History (last 50)</CardTitle>
          </CardHeader>
          <CardContent>
            {cutLogs.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No cuts recorded yet</p>}
            <div className="space-y-2">
              {cutLogs.map(log => (
                <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 border">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scissors className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">
                      {log.quantity_cut} × {log.part_name} <span className="text-slate-400 font-normal">({log.part_number})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {log.bar_stock_name} · {log.total_mm_used?.toLocaleString()}mm used · {log.mm_per_part}mm + {log.kerf_mm}mm kerf
                    </p>
                    <p className="text-xs text-slate-400">
                      {log.mm_before?.toLocaleString()}mm → {log.mm_after?.toLocaleString()}mm remaining · {log.user_name || log.user_email}
                    </p>
                    {log.notes && <p className="text-xs text-slate-400 italic mt-0.5">{log.notes}</p>}
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">
                    {log.created_date ? format(new Date(log.created_date), 'dd/MM/yy HH:mm') : ''}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Cut</DialogTitle>
            <DialogDescription>This will deduct from the billet and add to raw stock.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <div className="rounded-lg p-3 bg-slate-50 space-y-1">
              <p><strong>Part:</strong> {selectedPart?.part_name}</p>
              <p><strong>Quantity:</strong> {cutForm.quantity} parts</p>
              <p><strong>mm used:</strong> {totalMmNeeded().toLocaleString()}mm ({cutForm.mm_per_part}mm + {cutForm.kerf_mm}mm kerf × {cutForm.quantity})</p>
              <p><strong>Billet after:</strong> {((selectedBillet?.remaining_mm || 0) - totalMmNeeded()).toLocaleString()}mm remaining</p>
              <p><strong>Raw stock added:</strong> +{cutForm.quantity} to {selectedPart?.part_name}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={executeCut} disabled={saving} style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirm Cut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}