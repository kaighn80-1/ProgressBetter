import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ClipboardCheck, 
  Package, 
  Wrench,
  RefreshCw,
  Check,
  AlertTriangle,
  Loader2,
  Info,
  TrendingUp,
  Eye
} from 'lucide-react';

export default function PartialStockTake() {
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [itemsToCount, setItemsToCount] = useState([]);
  const [countData, setCountData] = useState({});
  const [notes, setNotes] = useState({});
  const [batchSize, setBatchSize] = useState(5);
  const [completed, setCompleted] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [blindCount, setBlindCount] = useState(true);
  const [revealedItems, setRevealedItems] = useState({});

  const generateNextBatch = async () => {
    setLoading(true);
    try {
      const [parts, fixings, wips, projects, sections, subsections] = await Promise.all([
        base44.entities.Part.list(),
        base44.entities.Fixing.list(),
        base44.entities.WorkInProgress.filter({ status: 'active' }),
        base44.entities.Project.list(),
        base44.entities.Section.list(),
        base44.entities.Subsection.list()
      ]);

      // Calculate WIP quantities by part
      const wipByPart = {};
      wips.forEach(wip => {
        if (!wipByPart[wip.part_id]) wipByPart[wip.part_id] = 0;
        wipByPart[wip.part_id] += wip.quantity || 0;
      });

      // Combine and score items for counting priority
      const allItems = [
        ...parts.map(p => ({ 
          ...p, 
          type: 'part', 
          name: p.part_name, 
          number: p.part_number,
          stock: p.finished_stock || 0,
          wip_quantity: wipByPart[p.id] || 0,
          last_counted: p.last_counted_date,
          project_name: p.project_name,
          section_name: p.section_name,
          subsection_name: p.subsection_name
        })),
        ...fixings.map(f => ({ 
          ...f, 
          type: 'fixing', 
          name: f.fixing_name, 
          number: f.sku,
          stock: f.current_stock || 0,
          wip_quantity: 0,
          last_counted: f.last_counted_date,
          project_name: null,
          section_name: null,
          subsection_name: null
        }))
      ];

      // Score by: older counts first, then by stock value
      const scored = allItems.map(item => {
        let score = 0;
        
        // Prioritize never counted or old counts
        if (!item.last_counted) {
          score += 1000;
        } else {
          const daysSince = Math.floor((Date.now() - new Date(item.last_counted).getTime()) / (1000 * 60 * 60 * 24));
          score += Math.min(daysSince, 100);
        }
        
        // Add stock value (items with more stock = higher priority)
        score += (item.stock || 0) * 0.1;
        
        return { ...item, score };
      });

      // Sort by score and take batch size
      const selected = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, batchSize);

      setItemsToCount(selected);
      setCountData({});
      setNotes({});
      setCompleted([]);
      setShowSummary(false);
      setRevealedItems({});
      toast.success(`${selected.length} items ready to count`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate batch');
    } finally {
      setLoading(false);
    }
  };

  const submitCount = async (item) => {
    const actualCount = parseFloat(countData[item.id]);
    
    if (isNaN(actualCount) || actualCount < 0) {
      toast.error('Please enter a valid count');
      return;
    }

    const variance = actualCount - item.stock;
    const variancePercent = item.stock > 0 ? Math.abs((variance / item.stock) * 100) : 0;

    // Require notes for significant variance
    if (variancePercent > 10 && !notes[item.id]?.trim()) {
      toast.error('Please add notes for this variance');
      return;
    }

    setCounting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (item.type === 'part') {
        await base44.entities.Part.update(item.id, {
          finished_stock: actualCount,
          last_counted_date: today
        });

        if (variance !== 0) {
          await base44.entities.StockTransaction.create({
            part_id: item.id,
            part_name: item.name,
            transaction_type: 'adjustment',
            quantity_change: variance,
            user_email: (await base44.auth.me()).email,
            user_name: (await base44.auth.me()).full_name,
            notes: `Stock count adjustment: ${notes[item.id] || 'Cycle count'}`
          });
        }
      } else {
        await base44.entities.Fixing.update(item.id, {
          current_stock: actualCount,
          last_counted_date: today
        });
      }

      setCompleted([...completed, { ...item, actualCount, variance, variancePercent }]);
      
      const color = variance === 0 ? 'green' : 'amber';
      toast.success(`✓ ${item.name} counted`, {
        description: variance === 0 ? 'Perfect match!' : `Variance: ${variance > 0 ? '+' : ''}${variance}`,
        className: `bg-${color}-50 text-${color}-900`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to save count');
    } finally {
      setCounting(false);
    }
  };

  const completeBatch = () => {
    setShowSummary(true);
  };

  const matches = completed.filter(c => c.variance === 0).length;
  const discrepancies = completed.length - matches;

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Partial Stock Take</h1>
        <p className="text-sm text-slate-500">Cycle counting for inventory accuracy</p>
      </div>

      {itemsToCount.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-4">No Active Count</h3>
            
            <div className="max-w-md mx-auto mb-6 space-y-3">
              <div className="flex items-center gap-2 justify-center">
                <Label>Items to count:</Label>
                <Input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                  className="w-20"
                  min={1}
                  max={20}
                />
              </div>
              <div className="flex items-center gap-2 justify-center">
                <input
                  type="checkbox"
                  id="blindCount"
                  checked={blindCount}
                  onChange={(e) => setBlindCount(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="blindCount" className="cursor-pointer">
                  Blind count (hide current stock)
                </Label>
              </div>
            </div>
            
            <Button onClick={generateNextBatch} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-5 h-5 mr-2" />
              Generate Next {batchSize}
            </Button>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-slate-600 max-w-md mx-auto">
              <Info className="w-4 h-4 inline mr-2 text-blue-600" />
              <span className="font-medium">Cycle counting</span> helps maintain accurate inventory by counting a small number of items regularly.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Progress</p>
                  <p className="text-2xl font-bold text-slate-900">{completed.length} / {itemsToCount.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Accuracy</p>
                  <p className="text-2xl font-bold text-green-600">
                    {completed.length > 0 ? Math.round((matches / completed.length) * 100) : 0}%
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${(completed.length / itemsToCount.length) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Count Items */}
          <div className="space-y-3">
            {itemsToCount.map((item) => {
              const isCompleted = completed.some(c => c.id === item.id);
              const Icon = item.type === 'part' ? Package : Wrench;
              
              return (
                <Card 
                  key={item.id} 
                  className={`border-0 shadow-md ${isCompleted ? 'opacity-50 bg-slate-50' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-7 h-7 text-green-600" />
                        ) : (
                          <Icon className={`w-7 h-7 ${item.type === 'part' ? 'text-blue-600' : 'text-amber-600'}`} />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900">{item.number}</h3>
                        <p className="text-sm text-slate-600 font-medium">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.number}</p>
                        
                        {item.project_name && (
                          <p className="text-xs text-blue-600 mt-1">
                            {item.project_name}
                            {item.section_name && ` → ${item.section_name}`}
                            {item.subsection_name && ` → ${item.subsection_name}`}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {blindCount && !revealedItems[item.id] ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRevealedItems({ ...revealedItems, [item.id]: true })}
                              className="text-xs h-7"
                            >
                              Show Current Stock
                            </Button>
                          ) : (
                            <>
                              <Badge variant="outline">
                                Finished: {item.stock} {item.unit || 'pcs'}
                              </Badge>
                              {item.wip_quantity > 0 && (
                                <Badge variant="outline" className="bg-blue-50 border-blue-300 text-blue-700">
                                  WIP: {item.wip_quantity} {item.unit || 'pcs'}
                                </Badge>
                              )}
                            </>
                          )}
                          {item.location && (
                            <span className="text-xs text-slate-500">📍 {item.location}</span>
                          )}
                          {item.last_counted && (
                            <span className="text-xs text-slate-500">
                              Last: {format(new Date(item.last_counted), 'MMM d, yyyy')}
                            </span>
                          )}
                          {!item.last_counted && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              Never counted
                            </Badge>
                          )}
                        </div>

                        {!isCompleted && (
                          <div className="mt-4 space-y-3">
                            <div>
                              <Label>Actual Count *</Label>
                              <Input
                                type="number"
                                value={countData[item.id] || ''}
                                onChange={(e) => setCountData({ ...countData, [item.id]: e.target.value })}
                                placeholder="Enter count..."
                                className="mt-1 h-12 text-lg"
                                min="0"
                              />
                            </div>

                            <div>
                              <Label>Notes {(() => {
                                const val = parseFloat(countData[item.id]);
                                if (!isNaN(val) && item.stock > 0) {
                                  const pct = Math.abs(((val - item.stock) / item.stock) * 100);
                                  if (pct > 10) return '(required for >10% variance)';
                                }
                                return '(optional)';
                              })()}</Label>
                              <Textarea
                                value={notes[item.id] || ''}
                                onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                                placeholder="Reason for variance..."
                                className="mt-1"
                                rows={2}
                              />
                            </div>

                            <Button 
                              onClick={() => submitCount(item)}
                              disabled={counting || !countData[item.id]}
                              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                            >
                              {counting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                              Confirm Count
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {completed.length === itemsToCount.length && (
            <Button 
              onClick={completeBatch}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Complete Batch
            </Button>
          )}
        </>
      )}

      {/* Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Complete!</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <Check className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-2xl font-bold text-green-600">{matches}</p>
                <p className="text-sm text-slate-600">Matches</p>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-xl text-center">
                <AlertTriangle className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                <p className="text-2xl font-bold text-amber-600">{discrepancies}</p>
                <p className="text-sm text-slate-600">Discrepancies</p>
              </div>
            </div>

            {completed.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {completed.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                    <span className="font-medium truncate">{item.name}</span>
                    <span className={`font-mono ${item.variance === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {item.variance > 0 ? '+' : ''}{item.variance}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSummary(false);
              setItemsToCount([]);
            }}>
              Done
            </Button>
            <Button onClick={() => {
              setShowSummary(false);
              generateNextBatch();
            }} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Next Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}