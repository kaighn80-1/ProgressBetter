import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Package, 
  Clock, 
  ArrowRight, 
  Check, 
  Trash2, 
  Loader2,
  Activity,
  User,
  ChevronRight,
  Pause,
  Play,
  CheckCircle,
  Circle
} from 'lucide-react';

export default function MyWIP() {
  const [user, setUser] = useState(null);
  const [wips, setWips] = useState([]);
  const [parts, setParts] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWip, setSelectedWip] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showScrapDialog, setShowScrapDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('my');
  
  const [moveForm, setMoveForm] = useState({ operation_id: '', notes: '' });
  const [completeForm, setCompleteForm] = useState({ notes: '' });
  const [scrapForm, setScrapForm] = useState({ reason: '' });
  const [pauseForm, setPauseForm] = useState({ notes: '' });

  useEffect(() => {
    loadData();
    
    // Check for WIP param in URL
    const params = new URLSearchParams(window.location.search);
    const wipId = params.get('wip');
    if (wipId) {
      loadWipDetail(wipId);
    }
  }, []);

  const loadData = async () => {
    try {
      const [userData, activeWips, pausedWips, ops, partsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.WorkInProgress.filter({ status: 'active' }, '-started_date'),
        base44.entities.WorkInProgress.filter({ status: 'paused' }, '-started_date'),
        base44.entities.Operation.list('sequence_number'),
        base44.entities.Part.list()
      ]);
      setUser(userData);
      setWips([...activeWips, ...pausedWips]);
      setOperations(ops);
      setParts(partsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadWipDetail = async (wipId) => {
    try {
      const wip = await base44.entities.WorkInProgress.filter({ id: wipId });
      if (wip.length > 0) {
        setSelectedWip(wip[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canViewAllWIPs = isAdmin || isSupervisor;
  const filteredWips = filter === 'all' ? wips : wips.filter(w => w.worker_email === user?.email);

  const getPartForWip = (wip) => parts.find(p => p.id === wip.part_id);
  
  const getWipProgress = (wip) => {
    const part = getPartForWip(wip);
    if (!part?.required_operations?.length) return null;
    const completed = wip.completed_operations?.length || 0;
    const total = part.required_operations.length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  };

  const moveToNextOperation = async () => {
    if (!moveForm.operation_id) {
      toast.error('Please select an operation');
      return;
    }

    setSaving(true);
    try {
      const newOperation = operations.find(o => o.id === moveForm.operation_id);
      
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        operation_id: moveForm.operation_id,
        operation_name: newOperation?.operation_name,
        notes: moveForm.notes || selectedWip.notes
      });

      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: 0,
        wip_id: selectedWip.id,
        operation_name: newOperation?.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: `Moved from ${selectedWip.operation_name} to ${newOperation?.operation_name}`
      });

      toast.success('Moved to next operation!');
      setShowMoveDialog(false);
      setMoveForm({ operation_id: '', notes: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to move batch');
    } finally {
      setSaving(false);
    }
  };

  const completeWip = async () => {
    setSaving(true);
    try {
      // Update WIP status
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        status: 'completed'
      });

      // Get the blank part
      const parts = await base44.entities.Part.filter({ id: selectedWip.part_id });
      if (parts.length === 0) {
        toast.error('Part not found');
        setSaving(false);
        return;
      }

      const blankPart = parts[0];
      let targetPartId = blankPart.id;
      let targetPartName = blankPart.part_name;
      let targetPartNumber = blankPart.part_number;
      
      // Handle symmetric opposites
      if (blankPart.allow_sym_opp && selectedWip.variant) {
        if (selectedWip.variant === 'LH') {
          // LH: Add to original blank part's finished stock
          const newStock = (blankPart.finished_stock || 0) + selectedWip.quantity;
          await base44.entities.Part.update(blankPart.id, {
            finished_stock: newStock
          });

          await base44.entities.StockTransaction.create({
            part_id: blankPart.id,
            part_name: blankPart.part_name,
            transaction_type: 'completed_production',
            quantity_change: selectedWip.quantity,
            wip_id: selectedWip.id,
            operation_name: selectedWip.operation_name,
            user_email: user?.email,
            user_name: user?.full_name,
            notes: `Completed LH → ${blankPart.part_number}`
          });

          toast.success('✓ Production completed!', { 
            description: `${selectedWip.quantity} units added to ${blankPart.part_number} (LH)`
          });
        } else if (selectedWip.variant === 'RH') {
          // RH: Find or create RH part
          const rhPartNumber = selectedWip.rh_part_number;
          if (!rhPartNumber) {
            toast.error('RH Part Number missing');
            setSaving(false);
            return;
          }

          // Look for existing part with this part number
          const allParts = await base44.entities.Part.list();
          let rhPart = allParts.find(p => p.part_number === rhPartNumber);

          if (!rhPart) {
            // Auto-create new RH part
            const rhPartName = selectedWip.rh_part_name || `${blankPart.part_name} RH`;
            rhPart = await base44.entities.Part.create({
              part_name: rhPartName,
              part_number: rhPartNumber,
              barcode: `${blankPart.barcode}-RH`,
              description: blankPart.description,
              unit: blankPart.unit,
              min_stock_level: blankPart.min_stock_level,
              reorder_quantity: blankPart.reorder_quantity,
              image_url: blankPart.image_url,
              category: blankPart.category,
              project_id: blankPart.project_id,
              project_name: blankPart.project_name,
              section_id: blankPart.section_id,
              section_name: blankPart.section_name,
              subsection_id: blankPart.subsection_id,
              subsection_name: blankPart.subsection_name,
              tooling_required: blankPart.tooling_required,
              tooling_location: blankPart.tooling_location,
              finish_type: blankPart.finish_type,
              location: blankPart.location,
              allow_sym_opp: false,
              finished_stock: selectedWip.quantity
            });

            await base44.entities.StockTransaction.create({
              part_id: rhPart.id,
              part_name: rhPart.part_name,
              transaction_type: 'completed_production',
              quantity_change: selectedWip.quantity,
              wip_id: selectedWip.id,
              operation_name: selectedWip.operation_name,
              user_email: user?.email,
              user_name: user?.full_name,
              notes: `Completed RH → ${rhPartNumber} (new part created)`
            });

            toast.success('✓ Production completed!', { 
              description: `${selectedWip.quantity} units added to ${rhPartNumber} (RH, new part created)`
            });
          } else {
            // Add to existing RH part
            const newStock = (rhPart.finished_stock || 0) + selectedWip.quantity;
            await base44.entities.Part.update(rhPart.id, {
              finished_stock: newStock
            });

            await base44.entities.StockTransaction.create({
              part_id: rhPart.id,
              part_name: rhPart.part_name,
              transaction_type: 'completed_production',
              quantity_change: selectedWip.quantity,
              wip_id: selectedWip.id,
              operation_name: selectedWip.operation_name,
              user_email: user?.email,
              user_name: user?.full_name,
              notes: `Completed RH → ${rhPartNumber}`
            });

            toast.success('✓ Production completed!', { 
              description: `${selectedWip.quantity} units added to ${rhPartNumber} (RH)`
            });
          }
        }
      } else {
        // Standard completion - add to blank's finished stock
        const newStock = (blankPart.finished_stock || 0) + selectedWip.quantity;
        await base44.entities.Part.update(blankPart.id, {
          finished_stock: newStock
        });

        await base44.entities.StockTransaction.create({
          part_id: blankPart.id,
          part_name: blankPart.part_name,
          transaction_type: 'completed_production',
          quantity_change: selectedWip.quantity,
          wip_id: selectedWip.id,
          operation_name: selectedWip.operation_name,
          user_email: user?.email,
          user_name: user?.full_name,
          notes: completeForm.notes || 'Production completed - added to finished stock'
        });

        toast.success('✓ Production completed!', { 
          description: `${selectedWip.quantity} units added to finished stock`
        });
      }

      setShowCompleteDialog(false);
      setCompleteForm({ notes: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to complete batch');
    } finally {
      setSaving(false);
    }
  };

  const scrapWip = async () => {
    if (!scrapForm.reason) {
      toast.error('Please provide a reason');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        status: 'scrapped',
        notes: `SCRAPPED: ${scrapForm.reason}`
      });

      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'scrapped',
        quantity_change: -selectedWip.quantity,
        wip_id: selectedWip.id,
        operation_name: selectedWip.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: scrapForm.reason
      });

      toast.success('Batch scrapped');
      setShowScrapDialog(false);
      setScrapForm({ reason: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to scrap batch');
    } finally {
      setSaving(false);
    }
  };

  const signOffOperation = async (operationId) => {
    setSaving(true);
    try {
      const completedOps = [...(selectedWip.completed_operations || []), operationId];
      const part = getPartForWip(selectedWip);
      const currentIndex = part?.required_operations?.indexOf(operationId) ?? -1;
      const nextIndex = currentIndex + 1;
      const nextOpId = part?.required_operations?.[nextIndex];
      const nextOp = operations.find(o => o.id === nextOpId);
      
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        completed_operations: completedOps,
        current_operation_index: nextIndex,
        operation_id: nextOpId || selectedWip.operation_id,
        operation_name: nextOp?.operation_name || selectedWip.operation_name
      });

      const op = operations.find(o => o.id === operationId);
      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: 0,
        wip_id: selectedWip.id,
        operation_name: op?.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: `Completed operation: ${op?.operation_name}`
      });

      toast.success(`${op?.operation_name} completed!`);
      
      // Refresh selected WIP
      const updatedWip = await base44.entities.WorkInProgress.filter({ id: selectedWip.id });
      if (updatedWip.length > 0) setSelectedWip(updatedWip[0]);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to sign off operation');
    } finally {
      setSaving(false);
    }
  };

  const pauseWip = async () => {
    setSaving(true);
    try {
      await base44.entities.WorkInProgress.update(selectedWip.id, {
        status: 'paused',
        notes: pauseForm.notes || 'Paused by operator'
      });

      // Return parts to RAW stock (not finished, they're still unfinished)
      const partData = await base44.entities.Part.filter({ id: selectedWip.part_id });
      if (partData.length > 0) {
        const newStock = (partData[0].raw_stock || 0) + selectedWip.quantity;
        await base44.entities.Part.update(selectedWip.part_id, {
          raw_stock: newStock
        });
      }

      await base44.entities.StockTransaction.create({
        part_id: selectedWip.part_id,
        part_name: selectedWip.part_name,
        transaction_type: 'adjustment',
        quantity_change: selectedWip.quantity,
        wip_id: selectedWip.id,
        operation_name: selectedWip.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: `Paused - returned to stock. Progress: ${selectedWip.completed_operations?.length || 0} operations done`
      });

      toast.success('Batch paused and returned to stock');
      setShowPauseDialog(false);
      setPauseForm({ notes: '' });
      setSelectedWip(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to pause batch');
    } finally {
      setSaving(false);
    }
  };

  const resumeWip = async (wip) => {
    setSaving(true);
    try {
      // Remove from stock
      const partData = await base44.entities.Part.filter({ id: wip.part_id });
      if (partData.length > 0) {
        const newStock = Math.max(0, (partData[0].finished_stock || 0) - wip.quantity);
        await base44.entities.Part.update(wip.part_id, {
          finished_stock: newStock
        });
      }

      await base44.entities.WorkInProgress.update(wip.id, {
        status: 'active',
        worker_email: user?.email,
        worker_name: user?.full_name
      });

      await base44.entities.StockTransaction.create({
        part_id: wip.part_id,
        part_name: wip.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: -wip.quantity,
        wip_id: wip.id,
        operation_name: wip.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: `Resumed from paused state`
      });

      toast.success('Batch resumed!');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to resume batch');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work In Progress</h1>
          <p className="text-sm text-slate-500">Manage your active batches</p>
        </div>
        {isAdmin && (
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="my">My WIP</TabsTrigger>
              <TabsTrigger value="all">All WIP</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* WIP List */}
      {filteredWips.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Activity className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No active batches</h3>
            <p className="text-sm text-slate-500">
              Scan a part barcode to start a new WIP batch
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWips.map((wip) => {
            const progress = getWipProgress(wip);
            const isPaused = wip.status === 'paused';
            
            return (
              <Card 
                key={wip.id} 
                className={`border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow ${isPaused ? 'border-l-4 border-l-amber-500' : ''}`}
                onClick={() => !isPaused ? setSelectedWip(wip) : null}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isPaused ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        {isPaused ? <Pause className="w-7 h-7 text-amber-600" /> : <Package className="w-7 h-7 text-blue-600" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{wip.part_name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className={isPaused ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
                            {isPaused ? 'Paused' : wip.operation_name}
                          </Badge>
                          <Badge variant="outline">
                            {wip.quantity} pcs
                          </Badge>
                          {progress && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {progress.completed}/{progress.total} ops
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(wip.started_date), 'MMM d, h:mm a')}
                          </span>
                          {filter === 'all' && wip.worker_email !== user?.email && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {wip.worker_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isPaused ? (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); resumeWip(wip); }} disabled={saving}>
                        <Play className="w-4 h-4 mr-1" /> Resume
                      </Button>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* WIP Detail Dialog */}
      <Dialog open={!!selectedWip && !showMoveDialog && !showCompleteDialog && !showScrapDialog && !showPauseDialog} onOpenChange={() => setSelectedWip(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWip?.part_name}</DialogTitle>
            <DialogDescription>
              Batch started {selectedWip && format(new Date(selectedWip.started_date), 'MMM d, yyyy h:mm a')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWip && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500">Quantity</p>
                  <p className="font-semibold text-slate-900">{selectedWip.quantity} pcs</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500">Worker</p>
                  <p className="font-semibold text-slate-900">{selectedWip.worker_name || 'Unknown'}</p>
                </div>
              </div>

              {/* Operations Checklist */}
              {(() => {
                const part = getPartForWip(selectedWip);
                if (part?.required_operations?.length > 0) {
                  const completedOps = selectedWip.completed_operations || [];
                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Operations Progress</p>
                      <div className="space-y-2">
                        {part.required_operations.map((opId, index) => {
                          const op = operations.find(o => o.id === opId);
                          const isCompleted = completedOps.includes(opId);
                          const isNext = !isCompleted && completedOps.length === index;
                          const isLocked = !isCompleted && completedOps.length < index;
                          
                          return (
                            <div 
                              key={opId} 
                              className={`flex items-center gap-3 p-3 rounded-xl border ${
                                isCompleted ? 'bg-green-50 border-green-200' : 
                                isNext ? 'bg-blue-50 border-blue-200' : 
                                'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                isCompleted ? 'bg-green-500 text-white' : 
                                isNext ? 'bg-blue-500 text-white' : 
                                'bg-slate-300 text-slate-500'
                              }`}>
                                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                              </div>
                              <span className={`flex-1 font-medium ${isCompleted ? 'text-green-700' : isLocked ? 'text-slate-400' : 'text-slate-700'}`}>
                                {op?.operation_name}
                              </span>
                              {isNext && (
                                <Button 
                                  size="sm" 
                                  onClick={() => signOffOperation(opId)}
                                  disabled={saving}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                  Sign Off
                                </Button>
                              )}
                              {isCompleted && (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500">Current Operation</p>
                    <p className="font-semibold text-slate-900">{selectedWip.operation_name}</p>
                  </div>
                );
              })()}

              {selectedWip.notes && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="text-sm text-slate-700">{selectedWip.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 pt-2">
                {(() => {
                  const part = getPartForWip(selectedWip);
                  const allComplete = part?.required_operations?.length > 0 && 
                    (selectedWip.completed_operations?.length || 0) >= part.required_operations.length;
                  
                  if (allComplete) {
                    return (
                      <Button 
                        onClick={() => setShowCompleteDialog(true)}
                        className="h-12 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        All Done - Return to Stock
                      </Button>
                    );
                  }
                  
                  return (
                    <>
                      {!part?.required_operations?.length && (
                        <Button 
                          onClick={() => setShowMoveDialog(true)}
                          className="h-12 bg-blue-600 hover:bg-blue-700"
                        >
                          <ArrowRight className="w-5 h-5 mr-2" />
                          Move to Next Operation
                        </Button>
                      )}
                      <Button 
                        variant="outline"
                        onClick={() => setShowPauseDialog(true)}
                        className="h-12 border-amber-500 text-amber-600 hover:bg-amber-50"
                      >
                        <Pause className="w-5 h-5 mr-2" />
                        Pause & Return to Stock
                      </Button>
                    </>
                  );
                })()}
                <Button 
                  variant="outline"
                  onClick={() => setShowCompleteDialog(true)}
                  className="h-12 border-green-500 text-green-600 hover:bg-green-50"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Complete & Return to Stock
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowScrapDialog(true)}
                  className="h-12 border-red-500 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Scrap Batch
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move to Next Operation Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Next Operation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Operation</Label>
              <Select 
                value={moveForm.operation_id} 
                onValueChange={(v) => setMoveForm({ ...moveForm, operation_id: v })}
              >
                <SelectTrigger className="h-12 mt-1">
                  <SelectValue placeholder="Select operation..." />
                </SelectTrigger>
                <SelectContent>
                  {operations
                    .filter(op => op.id !== selectedWip?.operation_id)
                    .map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.operation_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={moveForm.notes}
                onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={moveToNextOperation} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Move Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Batch</DialogTitle>
            <DialogDescription>
              {(() => {
                const part = getPartForWip(selectedWip);
                if (part?.allow_sym_opp && selectedWip?.variant) {
                  const variantPartId = selectedWip.variant === 'LH' ? part.lh_variant_part_id : part.rh_variant_part_id;
                  const variantPart = parts.find(p => p.id === variantPartId);
                  const displayNumber = selectedWip.variant === 'LH' 
                    ? (part.lh_part_number_override || variantPart?.part_number)
                    : (part.rh_part_number_override || variantPart?.part_number);
                  const displayName = selectedWip.variant === 'LH'
                    ? (part.lh_part_name_override || variantPart?.part_name)
                    : (part.rh_part_name_override || variantPart?.part_name);
                  
                  return `Completing ${selectedWip.quantity} units as ${selectedWip.variant} variant → will add to ${displayNumber || displayName || 'variant part'} stock`;
                }
                return `This will return ${selectedWip?.quantity} units to finished stock.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(() => {
              const part = getPartForWip(selectedWip);
              if (part?.allow_sym_opp && selectedWip?.variant) {
                const variantNotes = selectedWip.variant === 'LH' ? part.lh_notes : part.rh_notes;
                if (variantNotes) {
                  return (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-700 mb-1">{selectedWip.variant} Variant Notes:</p>
                      <p className="text-sm text-blue-900">{variantNotes}</p>
                    </div>
                  );
                }
              }
              return null;
            })()}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any completion notes..."
                value={completeForm.notes}
                onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={completeWip} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scrap Dialog */}
      <Dialog open={showScrapDialog} onOpenChange={setShowScrapDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Scrap Batch</DialogTitle>
            <DialogDescription>
              This will permanently remove {selectedWip?.quantity} units. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reason for Scrapping *</Label>
              <Textarea
                placeholder="Enter reason..."
                value={scrapForm.reason}
                onChange={(e) => setScrapForm({ ...scrapForm, reason: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScrapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={scrapWip} disabled={saving} variant="destructive">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Scrap Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pause & Return to Stock</DialogTitle>
            <DialogDescription>
              This will return {selectedWip?.quantity} units to stock. You can resume this batch later with progress saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add notes about current state..."
                value={pauseForm.notes}
                onChange={(e) => setPauseForm({ ...pauseForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={pauseWip} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pause className="w-4 h-4 mr-2" />}
              Pause Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}