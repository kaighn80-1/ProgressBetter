import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  Package, 
  Activity, 
  History,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  TrendingUp,
  Box,
  Clock
} from 'lucide-react';

export default function Reports() {
  const [parts, setParts] = useState([]);
  const [wips, setWips] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionFilter, setTransactionFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [partsData, wipsData, transData, opsData] = await Promise.all([
        base44.entities.Part.list('part_name'),
        base44.entities.WorkInProgress.filter({ status: 'active' }),
        base44.entities.StockTransaction.list('-created_date', 100),
        base44.entities.Operation.list('sequence_number')
      ]);
      setParts(partsData);
      setWips(wipsData);
      setTransactions(transData);
      setOperations(opsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const lowStockParts = parts.filter(p => 
    p.min_stock_level && (p.finished_stock || 0) < p.min_stock_level
  );

  const totalStock = parts.reduce((sum, p) => sum + (p.finished_stock || 0), 0);
  const totalWipQuantity = wips.reduce((sum, w) => sum + (w.quantity || 0), 0);

  const wipByOperation = operations.map(op => ({
    ...op,
    count: wips.filter(w => w.operation_id === op.id).length,
    quantity: wips.filter(w => w.operation_id === op.id).reduce((sum, w) => sum + (w.quantity || 0), 0)
  }));

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = !searchQuery || 
      t.part_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = transactionFilter === 'all' || t.transaction_type === transactionFilter;
    return matchesSearch && matchesType;
  });

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'added_to_stock':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'moved_to_wip':
        return <ArrowDownRight className="w-4 h-4 text-blue-500" />;
      case 'completed_wip':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'scrapped':
        return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTransactionBadge = (type) => {
    const configs = {
      added_to_stock: { label: 'Added', className: 'bg-green-100 text-green-700' },
      moved_to_wip: { label: 'To WIP', className: 'bg-blue-100 text-blue-700' },
      completed_wip: { label: 'Completed', className: 'bg-green-100 text-green-700' },
      scrapped: { label: 'Scrapped', className: 'bg-red-100 text-red-700' },
      adjustment: { label: 'Adjusted', className: 'bg-slate-100 text-slate-700' }
    };
    const config = configs[type] || { label: type, className: 'bg-slate-100 text-slate-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Stock overview and transaction history</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Box className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalStock.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Total Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalWipQuantity.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Units in WIP</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{parts.length}</p>
                <p className="text-xs text-slate-500">Total Parts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-md ${lowStockParts.length > 0 ? 'bg-red-50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                lowStockParts.length > 0 ? 'bg-red-100' : 'bg-slate-100'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  lowStockParts.length > 0 ? 'text-red-600' : 'text-slate-500'
                }`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lowStockParts.length}</p>
                <p className="text-xs text-slate-500">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alerts
            {lowStockParts.length > 0 && (
              <Badge variant="destructive" className="ml-1">{lowStockParts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wip" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            WIP
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Low Stock Alerts */}
        <TabsContent value="alerts" className="space-y-4">
          {lowStockParts.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-green-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">All Stock Levels OK</h3>
                <p className="text-sm text-slate-500">
                  No parts are below their minimum stock level
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lowStockParts.map((part) => (
                <Card key={part.id} className="border-0 shadow-md border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {part.image_url ? (
                          <img 
                            src={part.image_url} 
                            alt={part.part_name}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
                            <Package className="w-7 h-7 text-red-500" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-slate-900">{part.part_name}</h3>
                          <p className="text-sm text-slate-500">{part.part_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">{part.finished_stock || 0}</p>
                        <p className="text-xs text-slate-500">
                          Min: {part.min_stock_level} | Order: {part.reorder_quantity || '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* WIP Overview */}
        <TabsContent value="wip" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">WIP by Operation</CardTitle>
            </CardHeader>
            <CardContent>
              {wipByOperation.filter(op => op.count > 0).length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">No active WIP batches</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wipByOperation.filter(op => op.count > 0).map((op) => (
                    <div key={op.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{op.operation_name}</p>
                          <p className="text-xs text-slate-500">{op.count} batches</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        {op.quantity} units
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent WIP List */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Batches ({wips.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {wips.slice(0, 10).map((wip) => (
                  <div key={wip.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-medium text-sm text-slate-900">{wip.part_name}</p>
                      <p className="text-xs text-slate-500">
                        {wip.operation_name} • {wip.worker_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{wip.quantity} pcs</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(wip.started_date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by part or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={transactionFilter} onValueChange={setTransactionFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="added_to_stock">Added</SelectItem>
                <SelectItem value="moved_to_wip">To WIP</SelectItem>
                <SelectItem value="completed_wip">Completed</SelectItem>
                <SelectItem value="scrapped">Scrapped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-0 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Date</TableHead>
                    <TableHead>Part</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((trans) => (
                      <TableRow key={trans.id}>
                        <TableCell className="text-sm">
                          <div>{format(new Date(trans.created_date), 'MMM d')}</div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(trans.created_date), 'h:mm a')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{trans.part_name}</div>
                          {trans.operation_name && (
                            <div className="text-xs text-slate-500">{trans.operation_name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getTransactionBadge(trans.transaction_type)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${
                            trans.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trans.quantity_change > 0 ? '+' : ''}{trans.quantity_change}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {trans.user_name || trans.user_email?.split('@')[0]}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}