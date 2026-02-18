import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ScanBarcode, 
  Package, 
  AlertTriangle, 
  Plus, 
  ArrowRight,
  X,
  Check,
  Loader2,
  Search,
  Activity,
  Camera,
  Wrench,
  Hammer,
  Palette,
  Boxes,
  MapPin,
  Sparkles
} from 'lucide-react';

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [showScanner, setShowScanner] = useState(false);
  const [manualEntry, setManualEntry] = useState('');
  const [scannedPart, setScannedPart] = useState(null);
  const [operations, setOperations] = useState([]);
  const [activeWips, setActiveWips] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Action dialogs
  const [showWipDialog, setShowWipDialog] = useState(false);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [wipForm, setWipForm] = useState({ operation_id: '', quantity: '', notes: '' });
  const [addStockForm, setAddStockForm] = useState({ quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [userData, ops] = await Promise.all([
        base44.auth.me(),
        base44.entities.Operation.list('sequence_number')
      ]);
      setUser(userData);
      setOperations(ops);
    } catch (e) {
      console.error(e);
    }
  };

  const startCamera = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(true);
      toast.error('Camera access denied', { description: 'Use manual entry below' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const vibrateDevice = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
  };

  const playSuccessSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const handleScan = async (barcode) => {
    stopCamera();
    setShowScanner(false);
    setManualEntry('');
    setLoading(true);

    vibrateDevice();

    try {
      const parts = await base44.entities.Part.filter({ barcode: barcode });
      if (parts.length === 0) {
        toast.error('Part not found', { 
          description: `No part with barcode: ${barcode}`,
          duration: 5000
        });
        setScannedPart(null);
      } else {
        const part = parts[0];
        setScannedPart(part);
        
        // Load active WIPs for this part
        const wips = await base44.entities.WorkInProgress.filter({ 
          part_id: part.id, 
          status: 'active' 
        });
        setActiveWips(wips);
        
        playSuccessSound();
        toast.success('✓ Part Found!', { 
          description: part.part_name,
          duration: 4000
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Error looking up part');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = () => {
    if (manualEntry.trim()) {
      handleScan(manualEntry.trim());
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const parts = await base44.entities.Part.list();
      const filtered = parts.filter(p => 
        p.part_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const selectPart = async (part) => {
    setScannedPart(part);
    setSearchResults([]);
    setSearchQuery('');
    
    const wips = await base44.entities.WorkInProgress.filter({ 
      part_id: part.id, 
      status: 'active' 
    });
    setActiveWips(wips);
  };

  const startNewWip = async () => {
    if (!wipForm.operation_id || !wipForm.quantity || parseInt(wipForm.quantity) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const operation = operations.find(o => o.id === wipForm.operation_id);
      
      await base44.entities.WorkInProgress.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        part_barcode: scannedPart.barcode,
        operation_id: wipForm.operation_id,
        operation_name: operation?.operation_name,
        quantity: parseInt(wipForm.quantity),
        started_date: new Date().toISOString(),
        worker_email: user?.email,
        worker_name: user?.full_name,
        notes: wipForm.notes,
        status: 'active'
      });

      // Create transaction record
      await base44.entities.StockTransaction.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: -parseInt(wipForm.quantity),
        operation_name: operation?.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: wipForm.notes
      });

      // Deduct from finished stock
      await base44.entities.Part.update(scannedPart.id, {
        finished_stock: Math.max(0, (scannedPart.finished_stock || 0) - parseInt(wipForm.quantity))
      });

      toast.success('WIP batch started!');
      setShowWipDialog(false);
      setWipForm({ operation_id: '', quantity: '', notes: '' });
      
      // Navigate to My WIP
      navigate(createPageUrl('MyWIP'));
    } catch (e) {
      console.error(e);
      toast.error('Failed to start WIP batch');
    } finally {
      setSaving(false);
    }
  };

  const addToStock = async () => {
    if (!addStockForm.quantity || parseInt(addStockForm.quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      const newStock = (scannedPart.finished_stock || 0) + parseInt(addStockForm.quantity);
      
      await base44.entities.Part.update(scannedPart.id, {
        finished_stock: newStock
      });

      await base44.entities.StockTransaction.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        transaction_type: 'added_to_stock',
        quantity_change: parseInt(addStockForm.quantity),
        user_email: user?.email,
        user_name: user?.full_name,
        notes: addStockForm.notes
      });

      toast.success('Stock updated!', { description: `New total: ${newStock} ${scannedPart.unit || 'pcs'}` });
      setShowAddStockDialog(false);
      setAddStockForm({ quantity: '', notes: '' });
      
      // Refresh part data
      const updatedPart = await base44.entities.Part.filter({ id: scannedPart.id });
      if (updatedPart.length > 0) {
        setScannedPart(updatedPart[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const isLowStock = scannedPart && scannedPart.min_stock_level && 
    (scannedPart.finished_stock || 0) < scannedPart.min_stock_level;

  return (
    <div className="space-y-6 pb-24">
      {/* Camera Scanner Dialog */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            <h2 className="text-white font-bold text-lg">Scan Barcode</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                stopCamera();
                setShowScanner(false);
              }}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
          
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            onLoadedMetadata={startCamera}
          />
          
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="space-y-4">
              <p className="text-white text-center text-sm">Position barcode within frame</p>
              
              {cameraError && (
                <div className="bg-amber-500/90 text-white p-3 rounded-lg text-sm">
                  <p className="font-medium">Camera not available</p>
                  <p className="text-xs mt-1">Use manual entry below</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-white text-sm">Manual Entry:</Label>
                <div className="flex gap-2">
                  <Input
                    value={manualEntry}
                    onChange={(e) => setManualEntry(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
                    placeholder="Type barcode..."
                    className="h-14 text-lg bg-white/90 font-mono"
                  />
                  <Button 
                    onClick={handleManualScan}
                    disabled={!manualEntry.trim()}
                    className="h-14 px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    <Check className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Scan Parts</h1>
        <p className="text-slate-600">Scan barcode or search for parts</p>
      </div>

      {/* Scan Button */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-600 to-blue-700">
        <CardContent className="p-6">
          <Button 
            onClick={() => {
              setShowScanner(true);
              setCameraError(false);
            }}
            size="lg"
            className="w-full h-24 text-xl bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
          >
            <Camera className="w-10 h-10 mr-3" />
            <div className="text-left">
              <div className="font-bold">Scan Barcode</div>
              <div className="text-sm font-normal">Camera or manual entry</div>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Test Barcodes */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-4">
          <p className="text-xs text-amber-700 font-medium mb-3">🧪 Test Barcodes:</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleScan('123456789')}
              className="font-mono text-xs border-amber-300 hover:bg-amber-100"
            >
              123456789
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleScan('987654321')}
              className="font-mono text-xs border-amber-300 hover:bg-amber-100"
            >
              987654321
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleScan('555123456')}
              className="font-mono text-xs border-amber-300 hover:bg-amber-100"
            >
              555123456
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry / Search */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-5 h-5" />
            Manual Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-slate-600 mb-2 block">Enter Barcode:</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type barcode number..."
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
                className="h-14 text-lg font-mono"
              />
              <Button 
                onClick={handleManualScan}
                disabled={!manualEntry.trim() || loading}
                size="lg"
                className="h-14 px-8 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or Search</span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search by name, number, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-12"
              />
            </div>
            <Button onClick={handleSearch} className="h-12 px-6" disabled={searching}>
              {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((part) => (
                <button
                  key={part.id}
                  onClick={() => selectPart(part)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-sm">{part.part_name}</p>
                      <p className="text-xs text-slate-500">{part.part_number}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{part.finished_stock || 0} {part.unit || 'pcs'}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Scanned Part Result */}
      {scannedPart && !loading && (
        <div className="space-y-4">
          <Card className={`border-0 shadow-md ${isLowStock ? 'border-l-4 border-l-red-500' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {scannedPart.image_url ? (
                    <img 
                      src={scannedPart.image_url} 
                      alt={scannedPart.part_name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{scannedPart.part_name}</CardTitle>
                    <p className="text-sm text-slate-500">{scannedPart.part_number}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{scannedPart.barcode}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setScannedPart(null)}
                  className="text-slate-400"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stock Level */}
              <div className={`p-4 rounded-xl ${isLowStock ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Finished Stock</span>
                  {isLowStock && (
                    <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      Low Stock
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {scannedPart.finished_stock || 0}
                  </span>
                  <span className="text-lg text-slate-600">{scannedPart.unit || 'pcs'}</span>
                </div>
                {scannedPart.min_stock_level && (
                  <p className="text-xs text-slate-500 mt-2">
                    Min: {scannedPart.min_stock_level} | Reorder: {scannedPart.reorder_quantity || '-'}
                  </p>
                )}
              </div>

              {/* Part Details */}
              <div className="grid grid-cols-2 gap-3">
                {scannedPart.location && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-600 text-xs mb-1">
                      <MapPin className="w-3 h-3" />
                      Location
                    </div>
                    <p className="text-sm font-medium text-slate-900">{scannedPart.location}</p>
                  </div>
                )}
                {scannedPart.project_name && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-600 text-xs mb-1">
                      <Boxes className="w-3 h-3" />
                      Project
                    </div>
                    <p className="text-sm font-medium text-slate-900">{scannedPart.project_name}</p>
                  </div>
                )}
                {scannedPart.tooling_required && (
                  <div className="p-3 bg-amber-50 rounded-lg col-span-2">
                    <div className="flex items-center gap-2 text-amber-700 text-xs mb-1">
                      <Hammer className="w-3 h-3" />
                      Tooling Required
                    </div>
                    <p className="text-sm font-medium text-amber-900">{scannedPart.tooling_required}</p>
                    {scannedPart.tooling_location && (
                      <p className="text-xs text-amber-600 mt-1">📍 {scannedPart.tooling_location}</p>
                    )}
                  </div>
                )}
                {scannedPart.required_fixings?.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg col-span-2">
                    <div className="flex items-center gap-2 text-blue-700 text-xs mb-2">
                      <Wrench className="w-3 h-3" />
                      Fixings Required (per unit)
                    </div>
                    <div className="space-y-1">
                      {scannedPart.required_fixings.map((rf, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-blue-900">{rf.fixing_name}</span>
                          <span className="font-medium text-blue-700">{rf.quantity_per_unit}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {scannedPart.finish_type && (
                  <div className="p-3 bg-purple-50 rounded-lg col-span-2">
                    <div className="flex items-center gap-2 text-purple-700 text-xs mb-1">
                      <Palette className="w-3 h-3" />
                      Finish Type
                    </div>
                    <p className="text-sm font-medium text-purple-900">{scannedPart.finish_type}</p>
                  </div>
                )}
              </div>

              {/* Active WIP for this part */}
              {activeWips.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Active WIP Batches
                  </p>
                  {activeWips.map((wip) => (
                    <Link key={wip.id} to={createPageUrl(`MyWIP?wip=${wip.id}`)}>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                        <div>
                          <p className="font-medium text-sm text-blue-900">{wip.operation_name}</p>
                          <p className="text-xs text-blue-600">By: {wip.worker_name || wip.worker_email}</p>
                        </div>
                        <Badge className="bg-blue-600">{wip.quantity} {scannedPart.unit || 'pcs'}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Quick Actions
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => setShowWipDialog(true)}
                    size="lg"
                    className="h-20 bg-blue-600 hover:bg-blue-700 text-base flex-col gap-1"
                  >
                    <Plus className="w-6 h-6" />
                    <span>Start WIP Batch</span>
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowAddStockDialog(true)}
                    size="lg"
                    className="h-20 text-base flex-col gap-1 border-2"
                  >
                    <Plus className="w-6 h-6" />
                    <span>Add to Stock</span>
                  </Button>
                </div>
                
                <Button 
                  variant="secondary"
                  onClick={() => setShowDetailsDialog(true)}
                  className="w-full h-14 text-base bg-slate-100 hover:bg-slate-200"
                >
                  View Full Details
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                {scannedPart.assembly_number && (
                  <Button 
                    onClick={() => {
                      toast.info('Assembly workflow coming soon!');
                    }}
                    className="w-full h-12 bg-green-600 hover:bg-green-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Continue to Assembly
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Start WIP Dialog */}
      <Dialog open={showWipDialog} onOpenChange={setShowWipDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start WIP Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Operation / Process</Label>
              <Select 
                value={wipForm.operation_id} 
                onValueChange={(v) => setWipForm({ ...wipForm, operation_id: v })}
              >
                <SelectTrigger className="h-12 mt-1">
                  <SelectValue placeholder="Select operation..." />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.operation_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setWipForm({ ...wipForm, quantity: Math.max(1, parseInt(wipForm.quantity || 0) - 1).toString() })}
                  className="h-12 w-12 text-xl"
                >
                  -
                </Button>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={wipForm.quantity}
                  onChange={(e) => setWipForm({ ...wipForm, quantity: e.target.value })}
                  className="h-12 text-center text-xl font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setWipForm({ ...wipForm, quantity: (parseInt(wipForm.quantity || 0) + 1).toString() })}
                  className="h-12 w-12 text-xl"
                >
                  +
                </Button>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={wipForm.notes}
                onChange={(e) => setWipForm({ ...wipForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWipDialog(false)}>
              Cancel
            </Button>
            <Button onClick={startNewWip} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Start Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Quantity to Add</Label>
              <Input
                type="number"
                min="1"
                placeholder="Enter quantity..."
                value={addStockForm.quantity}
                onChange={(e) => setAddStockForm({ ...addStockForm, quantity: e.target.value })}
                className="h-12 mt-1"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g., New delivery, returned items..."
                value={addStockForm.notes}
                onChange={(e) => setAddStockForm({ ...addStockForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addToStock} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Part Details</DialogTitle>
          </DialogHeader>
          {scannedPart && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs text-slate-500">Part Name</Label>
                <p className="font-medium">{scannedPart.part_name}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Part Number</Label>
                <p className="font-medium">{scannedPart.part_number}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Barcode</Label>
                <p className="font-mono text-sm">{scannedPart.barcode}</p>
              </div>
              {scannedPart.description && (
                <div>
                  <Label className="text-xs text-slate-500">Description</Label>
                  <p className="text-sm">{scannedPart.description}</p>
                </div>
              )}
              {scannedPart.project_name && (
                <div>
                  <Label className="text-xs text-slate-500">Project / Section</Label>
                  <p className="font-medium">{scannedPart.project_name}</p>
                  {scannedPart.section_name && <p className="text-sm text-slate-600">→ {scannedPart.section_name}</p>}
                  {scannedPart.subsection_name && <p className="text-sm text-slate-600">→ {scannedPart.subsection_name}</p>}
                </div>
              )}
              {scannedPart.required_operation_names?.length > 0 && (
                <div>
                  <Label className="text-xs text-slate-500">Required Operations</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {scannedPart.required_operation_names.map((op, idx) => (
                      <Badge key={idx} variant="outline">{idx + 1}. {op}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {scannedPart.assembly_number && (
                <div>
                  <Label className="text-xs text-slate-500">Assembly Number</Label>
                  <p className="font-medium">{scannedPart.assembly_number}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}