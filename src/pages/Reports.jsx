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
  Clock,
  UserCircle,
  Download,
  Calendar,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function Reports() {
  const [parts, setParts] = useState([]);
  const [wips, setWips] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionFilter, setTransactionFilter] = useState('all');
  
  // Operator Activity state
  const [users, setUsers] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [timeFrame, setTimeFrame] = useState('month');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [operatorWips, setOperatorWips] = useState([]);
  const [operatorTransactions, setOperatorTransactions] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedOperator) {
      loadOperatorActivity();
    }
  }, [selectedOperator, timeFrame, customDate]);

  const loadCurrentUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [partsData, wipsData, transData, opsData, usersData] = await Promise.all([
        base44.entities.Part.list('part_name'),
        base44.entities.WorkInProgress.filter({ status: 'active' }),
        base44.entities.StockTransaction.list('-created_date', 100),
        base44.entities.Operation.list('sequence_number'),
        base44.entities.User.list()
      ]);
      setParts(partsData);
      setWips(wipsData);
      setTransactions(transData);
      setOperations(opsData);
      setUsers(usersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const start = new Date(customDate);
    let end = new Date(customDate);
    
    switch (timeFrame) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'total':
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }
    return { start, end };
  };

  const loadOperatorActivity = async () => {
    if (!selectedOperator) return;
    
    setLoadingActivity(true);
    try {
      const { start, end } = getDateRange();
      
      // Load all WIPs for operator (completed and active)
      const allWips = await base44.entities.WorkInProgress.list('-created_date', 500);
      let filteredWips = allWips.filter(w => w.worker_email === selectedOperator);
      
      // Load all transactions for operator
      const allTrans = await base44.entities.StockTransaction.list('-created_date', 500);
      let filteredTrans = allTrans.filter(t => t.user_email === selectedOperator);
      
      // Apply date filter if not 'total'
      if (start && end) {
        filteredWips = filteredWips.filter(w => {
          const wipDate = new Date(w.started_date || w.created_date);
          return wipDate >= start && wipDate <= end;
        });
        
        filteredTrans = filteredTrans.filter(t => {
          const transDate = new Date(t.created_date);
          return transDate >= start && transDate <= end;
        });
      }
      
      setOperatorWips(filteredWips);
      setOperatorTransactions(filteredTrans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingActivity(false);
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
      adjustment: { label: 'Adjusted', className: 'bg-slate-100 text-slate-700' },
      delivered: { label: 'Delivered', className: 'bg-purple-100 text-purple-700' }
    };
    const config = configs[type] || { label: type, className: 'bg-slate-100 text-slate-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Operator Activity Calculations
  const completedBatches = operatorWips.filter(w => w.status === 'completed').length;
  const totalPartsCompleted = operatorTransactions
    .filter(t => t.transaction_type === 'completed_wip')
    .reduce((sum, t) => sum + Math.abs(t.quantity_change), 0);
  const totalScrapped = operatorTransactions
    .filter(t => t.transaction_type === 'scrapped')
    .reduce((sum, t) => sum + Math.abs(t.quantity_change), 0);
  
  const totalTimeMinutes = operatorWips.reduce((sum, wip) => {
    if (wip.operation_times && Array.isArray(wip.operation_times)) {
      return sum + wip.operation_times.reduce((opSum, op) => opSum + (op.duration_minutes || 0), 0);
    }
    return sum;
  }, 0);
  
  const avgTimePerOp = completedBatches > 0 
    ? (totalTimeMinutes / completedBatches).toFixed(1) 
    : 0;

  const handleExportActivity = () => {
    const selectedUser = users.find(u => u.email === selectedOperator);
    const userName = selectedUser?.full_name || selectedOperator;
    
    let csvContent = `Operator Activity Report - ${userName}\n`;
    csvContent += `Period: ${timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1)}\n`;
    csvContent += `Generated: ${format(new Date(), 'PPP')}\n\n`;
    
    csvContent += `Date,Part Name,Part Number,Project,Operation,Quantity,Status,Time (min),Batch ID\n`;
    
    operatorWips.forEach(wip => {
      const wipDate = format(new Date(wip.started_date || wip.created_date), 'yyyy-MM-dd');
      const time = wip.operation_times?.reduce((sum, op) => sum + (op.duration_minutes || 0), 0) || 0;
      csvContent += `${wipDate},${wip.part_name || ''},${wip.part_barcode || ''},${wip.project_id || ''},${wip.operation_name || ''},${wip.quantity},${wip.status},${time},${wip.id}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operator-activity-${userName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const isManager = user?.role === 'admin' || user?.role === 'manager';

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
        <TabsList className="w-full justify-start overflow-x-auto">
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
          {isManager && (
            <TabsTrigger value="operator" className="flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Operator Activity
            </TabsTrigger>
          )}
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

        {/* Operator Activity Tab */}
        {isManager && (
          <TabsContent value="operator" className="space-y-4">
            {/* Filters */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block" style={{ color: '#1E293B' }}>
                      Select Operator
                    </label>
                    <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Choose operator..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.email} value={u.email}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block" style={{ color: '#1E293B' }}>
                      Time Frame
                    </label>
                    <Select value={timeFrame} onValueChange={setTimeFrame}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="total">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block" style={{ color: '#1E293B' }}>
                      Date
                    </label>
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {!selectedOperator ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-16 text-center">
                  <UserCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#CBD5E1' }} />
                  <h3 className="font-semibold mb-2" style={{ color: '#1E293B' }}>
                    Select an Operator
                  </h3>
                  <p style={{ color: '#64748B' }}>
                    Choose an operator above to view their activity and performance
                  </p>
                </CardContent>
              </Card>
            ) : loadingActivity ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-64" />
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
                          style={{ backgroundColor: '#D1FAE5' }}>
                          <CheckCircle2 className="w-5 h-5" style={{ color: '#10B981' }} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>
                            {totalPartsCompleted}
                          </p>
                          <p className="text-xs" style={{ color: '#64748B' }}>Parts Completed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: '#DBEAFE' }}>
                          <Activity className="w-5 h-5" style={{ color: '#3B82F6' }} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>
                            {completedBatches}
                          </p>
                          <p className="text-xs" style={{ color: '#64748B' }}>Batches Done</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: '#E0E7FF' }}>
                          <Clock className="w-5 h-5" style={{ color: '#3B82F6' }} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>
                            {Math.floor(totalTimeMinutes / 60)}h {Math.round(totalTimeMinutes % 60)}m
                          </p>
                          <p className="text-xs" style={{ color: '#64748B' }}>Total Time</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: totalScrapped > 0 ? '#FED7AA' : '#F1F5F9' }}>
                          <XCircle className="w-5 h-5" style={{ color: totalScrapped > 0 ? '#F59E0B' : '#CBD5E1' }} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>
                            {totalScrapped}
                          </p>
                          <p className="text-xs" style={{ color: '#64748B' }}>Scrapped</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleExportActivity}
                    variant="outline"
                    disabled={operatorWips.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Detailed Activity Table */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base">Detailed Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {operatorWips.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: '#CBD5E1' }} />
                        <p style={{ color: '#64748B' }}>
                          No activity found for this operator in the selected period
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow style={{ backgroundColor: '#F8FAFC' }}>
                              <TableHead>Date</TableHead>
                              <TableHead>Part</TableHead>
                              <TableHead>Project</TableHead>
                              <TableHead>Operation</TableHead>
                              <TableHead className="text-center">Qty</TableHead>
                              <TableHead className="text-center">Time</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {operatorWips.map((wip) => {
                              const totalTime = wip.operation_times?.reduce((sum, op) => 
                                sum + (op.duration_minutes || 0), 0) || 0;
                              return (
                                <TableRow key={wip.id}>
                                  <TableCell className="text-sm">
                                    <div>{format(new Date(wip.started_date || wip.created_date), 'MMM d, yyyy')}</div>
                                    <div className="text-xs" style={{ color: '#64748B' }}>
                                      {format(new Date(wip.started_date || wip.created_date), 'h:mm a')}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium text-sm">{wip.part_name}</div>
                                    <div className="text-xs" style={{ color: '#64748B' }}>
                                      {wip.part_barcode}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm" style={{ color: '#64748B' }}>
                                    {wip.project_id || '-'}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {wip.operation_name}
                                  </TableCell>
                                  <TableCell className="text-center font-bold">
                                    {wip.quantity}
                                  </TableCell>
                                  <TableCell className="text-center text-sm">
                                    {totalTime > 0 
                                      ? `${Math.floor(totalTime / 60)}h ${Math.round(totalTime % 60)}m`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      style={{
                                        backgroundColor: wip.status === 'completed' ? '#D1FAE5' : 
                                                       wip.status === 'scrapped' ? '#FEE2E2' : '#DBEAFE',
                                        color: wip.status === 'completed' ? '#065F46' :
                                               wip.status === 'scrapped' ? '#991B1B' : '#1E40AF'
                                      }}
                                    >
                                      {wip.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}

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