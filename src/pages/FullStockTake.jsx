import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ClipboardList, 
  Package, 
  Wrench,
  Download,
  Check,
  AlertTriangle,
  Search,
  Loader2,
  Info
} from 'lucide-react';

export default function FullStockTake() {
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [countData, setCountData] = useState({});
  const [completed, setCompleted] = useState({});
  const [isActive, setIsActive] = useState(false);

  const startFullCount = async () => {
    setLoading(true);
    try {
      const [parts, fixings, wips] = await Promise.all([
        base44.entities.Part.list(),
        base44.entities.Fixing.list(),
        base44.entities.WorkInProgress.filter({ status: 'active' })
      ]);

      // Calculate WIP quantities by part
      const wipByPart = {};
      wips.forEach(wip => {
        if (!wipByPart[wip.part_id]) wipByPart[wip.part_id] = 0;
        wipByPart[wip.part_id] += wip.quantity || 0;
      });

      const items = [
        ...parts.map(p => ({ 
          ...p, 
          type: 'part', 
          name: p.part_name, 
          number: p.part_number,
          stock: p.finished_stock || 0,
          wip_quantity: wipByPart[p.id] || 0,
          project: p.project_name || '',
          section: p.section_name || '',
          subsection: p.subsection_name || ''
        })),
        ...fixings.map(f => ({ 
          ...f, 
          type: 'fixing', 
          name: f.fixing_name, 
          number: f.sku,
          stock: f.current_stock || 0,
          wip_quantity: 0,
          project: '',
          section: '',
          subsection: ''
        }))
      ];

      setAllItems(items);
      setCountData({});
      setCompleted({});
      setIsActive(true);
      toast.success(`Full count started - ${items.length} items to count`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to start count');
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

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const variance = actualCount - item.stock;
      
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
            notes: `Full stock take adjustment`
          });
        }
      } else {
        await base44.entities.Fixing.update(item.id, {
          current_stock: actualCount,
          last_counted_date: today
        });
      }

      setCompleted({ ...completed, [item.id]: { actualCount, variance } });
      toast.success(`✓ ${item.name} counted`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save count');
    }
  };

  const exportResults = () => {
    const results = allItems.map(item => {
      const c = completed[item.id];
      return {
        Type: item.type,
        Project: item.project || 'N/A',
        Section: item.section || 'N/A',
        Subsection: item.subsection || 'N/A',
        Name: item.name,
        Number: item.number,
        'System Stock': item.stock,
        'Actual Count': c ? c.actualCount : 'Not counted',
        Variance: c ? c.variance : 'N/A',
        Location: item.location || 'N/A',
        'Last Counted': item.last_counted_date || 'Never'
      };
    });

    const csv = [
      Object.keys(results[0]).join(','),
      ...results.map(r => Object.values(r).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-stock-take-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    toast.success('Export complete');
  };

  const filteredItems = allItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const countedCount = Object.keys(completed).length;
  const totalVariance = Object.values(completed).reduce((sum, c) => sum + Math.abs(c.variance), 0);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Full Stock Take</h1>
          <p className="text-sm text-slate-500">Complete inventory count</p>
        </div>
        {isActive && (
          <Button onClick={exportResults} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {!isActive ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-4">No Active Full Count</h3>
            
            <div className="max-w-md mx-auto mb-6 p-4 bg-amber-50 rounded-lg text-sm text-left space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">This is time-intensive</p>
                  <p className="text-amber-700 mt-1">A full stock take will require counting all parts and fixings. Consider using Partial Stock Take for regular cycle counting.</p>
                </div>
              </div>
            </div>
            
            <Button onClick={startFullCount} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <ClipboardList className="w-5 h-5 mr-2" />
              Start Full Count
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Progress</p>
                <p className="text-2xl font-bold text-slate-900">{countedCount} / {allItems.length}</p>
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${(countedCount / allItems.length) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Matches</p>
                <p className="text-2xl font-bold text-green-600">
                  {Object.values(completed).filter(c => c.variance === 0).length}
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Total Variance</p>
                <p className="text-2xl font-bold text-amber-600">{totalVariance}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>

          {/* Items */}
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const isCounted = !!completed[item.id];
              const Icon = item.type === 'part' ? Package : Wrench;
              
              return (
                <Card 
                  key={item.id} 
                  className={`border-0 shadow-sm ${isCounted ? 'bg-slate-50' : ''}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCounted ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {isCounted ? (
                          <Check className="w-6 h-6 text-green-600" />
                        ) : (
                          <Icon className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div>
                          <p className="font-bold text-slate-900 truncate">{item.number}</p>
                          <p className="text-xs text-slate-600 font-medium">{item.name}</p>
                        </div>
                        
                        <div className="text-sm">
                          {item.project && <p className="text-slate-600 text-xs truncate">{item.project}</p>}
                          {item.section && <p className="text-xs text-slate-500 truncate">{item.section}</p>}
                          {item.subsection && <p className="text-xs text-slate-400 truncate">{item.subsection}</p>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-xs">
                            Finished: {item.stock}
                          </Badge>
                          {item.wip_quantity > 0 && (
                            <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">
                              WIP: {item.wip_quantity}
                            </Badge>
                          )}
                        </div>

                        {!isCounted ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={countData[item.id] || ''}
                              onChange={(e) => setCountData({ ...countData, [item.id]: e.target.value })}
                              placeholder="Count..."
                              className="h-9 text-sm"
                              min="0"
                            />
                            <Button 
                              size="sm"
                              onClick={() => submitCount(item)}
                              disabled={!countData[item.id]}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700">
                              Counted: {completed[item.id].actualCount}
                            </Badge>
                            {completed[item.id].variance !== 0 && (
                              <span className="text-xs text-amber-600 font-medium">
                                {completed[item.id].variance > 0 ? '+' : ''}{completed[item.id].variance}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}