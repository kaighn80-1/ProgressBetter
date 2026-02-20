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
import { Html5Qrcode } from 'html5-qrcode';
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
  Sparkles,
  Flashlight,
  FlashlightOff,
  AlertCircle
} from 'lucide-react';

export default function Scan() {
  const navigate = useNavigate();
  const html5QrCodeRef = useRef(null);
  const scannerDivRef = useRef(null);
  const noDetectionTimeoutRef = useRef(null);
  
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
  const [scanning, setScanning] = useState(false);
  const [showFixings, setShowFixings] = useState(false);
  const [fixingDetails, setFixingDetails] = useState([]);

  // Action dialogs
  const [showWipDialog, setShowWipDialog] = useState(false);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [wipForm, setWipForm] = useState({ operation_id: '', quantity: '', lh_quantity: '', rh_quantity: '', notes: '' });
  const [addStockForm, setAddStockForm] = useState({ quantity: '', notes: '', variant: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (showScanner) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [showScanner]);

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

  const startScanner = async () => {
    setCameraError(false);
    setScanning(true);
    
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      // Set timeout for no detection
      noDetectionTimeoutRef.current = setTimeout(() => {
        toast('No barcode detected yet', {
          description: 'Try manual entry or better lighting',
          duration: 4000
        });
      }, 10000);
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.777,
        disableFlip: false,
        rememberLastUsedCamera: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        formatsToSupport: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
        ]
      };
      
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          console.log('✅ Barcode detected:', decodedText);
          vibrateDevice();
          playSuccessSound();
          if (noDetectionTimeoutRef.current) {
            clearTimeout(noDetectionTimeoutRef.current);
          }
          stopScanner();
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Silent - scanning errors are normal while looking for codes
        }
      );
      
      toast.success('Camera ready - scan barcode', { duration: 2000 });
    } catch (err) {
      console.error('Scanner error:', err);
      setCameraError(true);
      setScanning(false);
      
      if (err.name === 'NotAllowedError' || err.toString().includes('Permission')) {
        toast.error('Camera access denied', {
          description: 'Check browser settings or use manual entry',
          duration: 6000
        });
      } else {
        toast.error('Camera unavailable', {
          description: 'Use manual entry below',
          duration: 5000
        });
      }
    }
  };

  const stopScanner = async () => {
    if (noDetectionTimeoutRef.current) {
      clearTimeout(noDetectionTimeoutRef.current);
    }
    
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.log('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    
    setScanning(false);
    setCameraError(false);
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

  const [parts, setParts] = useState([]);

  const handleScan = async (barcode) => {
    setShowScanner(false);
    setManualEntry('');
    setLoading(true);

    try {
      const allParts = await base44.entities.Part.list();
      setParts(allParts);
      
      const matchingParts = allParts.filter(p => p.barcode === barcode);
      if (matchingParts.length === 0) {
        toast.error('Part not found', { 
          description: `No part with barcode: ${barcode}`,
          duration: 5000
        });
        setScannedPart(null);
      } else {
        const part = matchingParts[0];
        setScannedPart(part);
        
        // Load active WIPs for this part
        const wips = await base44.entities.WorkInProgress.filter({ 
          part_id: part.id, 
          status: 'active' 
        });
        setActiveWips(wips);
        
        // Load fixing details if part has fixings
        if (part.required_fixings?.length > 0) {
          const fixingIds = part.required_fixings.map(rf => rf.fixing_id);
          const allFixings = await base44.entities.Fixing.list();
          const relevantFixings = allFixings.filter(f => fixingIds.includes(f.id));
          
          const enriched = part.required_fixings.map(rf => {
            const fixing = relevantFixings.find(f => f.id === rf.fixing_id);
            return {
              ...rf,
              sku: fixing?.sku,
              current_stock: fixing?.current_stock || 0,
              min_stock_level: fixing?.min_stock_level,
              location: fixing?.location,
              unit: fixing?.unit
            };
          });
          setFixingDetails(enriched);
        } else {
          setFixingDetails([]);
        }
        
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
      // Sort by project_num, module_letter, part_seq
      filtered.sort((a, b) => {
        if (a.project_num !== b.project_num) return (a.project_num || 0) - (b.project_num || 0);
        if ((a.module_letter || '') !== (b.module_letter || '')) return (a.module_letter || '').localeCompare(b.module_letter || '');
        return (a.part_seq || 0) - (b.part_seq || 0);
      });
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
    
    // Load fixing details if part has fixings
    if (part.required_fixings?.length > 0) {
      const fixingIds = part.required_fixings.map(rf => rf.fixing_id);
      const allFixings = await base44.entities.Fixing.list();
      const relevantFixings = allFixings.filter(f => fixingIds.includes(f.id));
      
      const enriched = part.required_fixings.map(rf => {
        const fixing = relevantFixings.find(f => f.id === rf.fixing_id);
        return {
          ...rf,
          sku: fixing?.sku,
          current_stock: fixing?.current_stock || 0,
          min_stock_level: fixing?.min_stock_level,
          location: fixing?.location,
          unit: fixing?.unit
        };
      });
      setFixingDetails(enriched);
    } else {
      setFixingDetails([]);
    }
  };

  const startNewWip = async () => {
    if (!wipForm.operation_id || !wipForm.quantity || parseInt(wipForm.quantity) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const totalQty = parseInt(wipForm.quantity);
    const lhQty = parseInt(wipForm.lh_quantity) || 0;
    const rhQty = parseInt(wipForm.rh_quantity) || 0;

    if (scannedPart.allow_sym_opp && (lhQty + rhQty !== totalQty)) {
      toast.error('LH Quantity + RH Quantity must equal Total Quantity');
      return;
    }

    if (scannedPart.allow_sym_opp && rhQty > 0 && !scannedPart.rh_part_number) {
      toast.error('RH Part Number not set on this blank part. Contact manager.');
      return;
    }

    setSaving(true);
    try {
      const operation = operations.find(o => o.id === wipForm.operation_id);
      
      const wipData = {
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        part_barcode: scannedPart.barcode,
        operation_id: wipForm.operation_id,
        operation_name: operation?.operation_name,
        quantity: totalQty,
        lh_quantity: scannedPart.allow_sym_opp ? lhQty : totalQty,
        rh_quantity: scannedPart.allow_sym_opp ? rhQty : 0,
        rh_part_number: scannedPart.rh_part_number || '',
        rh_part_name: scannedPart.rh_part_name || '',
        started_date: new Date().toISOString(),
        worker_email: user?.email,
        worker_name: user?.full_name,
        notes: wipForm.notes,
        status: 'active'
      };
      
      await base44.entities.WorkInProgress.create(wipData);

      // Create transaction record
      await base44.entities.StockTransaction.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        transaction_type: 'moved_to_wip',
        quantity_change: -totalQty,
        operation_name: operation?.operation_name,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: wipForm.notes
      });

      // Deduct from RAW stock (starting production uses raw blanks)
      await base44.entities.Part.update(scannedPart.id, {
        raw_stock: Math.max(0, (scannedPart.raw_stock || 0) - totalQty)
      });

      toast.success('WIP batch started!', {
        description: scannedPart.allow_sym_opp ? `${lhQty} LH, ${rhQty} RH` : undefined
      });
      setShowWipDialog(false);
      setWipForm({ operation_id: '', quantity: '', lh_quantity: '', rh_quantity: '', notes: '' });
      
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
      const qty = parseInt(addStockForm.quantity);
      
      // Add to RAW STOCK only (unworked blanks/raw parts)
      const newRawStock = (scannedPart.raw_stock || 0) + qty;
      await base44.entities.Part.update(scannedPart.id, {
        raw_stock: newRawStock
      });

      await base44.entities.StockTransaction.create({
        part_id: scannedPart.id,
        part_name: scannedPart.part_name,
        transaction_type: 'received_raw_stock',
        quantity_change: qty,
        user_email: user?.email,
        user_name: user?.full_name,
        notes: addStockForm.notes
      });

      toast.success('✓ Raw stock added!', {
        description: `Added ${qty} unworked blanks for ${scannedPart.part_name}`
      });
      setShowAddStockDialog(false);
      setAddStockForm({ quantity: '', notes: '', variant: '' });
      
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
                stopScanner();
                setShowScanner(false);
              }}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
          
          {cameraError ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="max-w-md text-center">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-3">Camera Not Available</h3>
                <p className="text-white/90 mb-4">Use manual entry instead</p>
                
                <div className="bg-white/10 rounded-lg p-4 text-left text-sm space-y-2 mb-4">
                  <p className="text-white font-semibold mb-2">Check browser settings:</p>
                  <p className="text-white/90"><strong>Chrome/Edge:</strong> Settings → Site Settings → Camera → Allow for this site</p>
                  <p className="text-white/90"><strong>Safari:</strong> Settings → Safari → Camera → Allow</p>
                </div>
                
                <Button
                  size="lg"
                  onClick={() => {
                    stopScanner();
                    setShowScanner(false);
                  }}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Close and Use Manual Entry
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div id="qr-reader" ref={scannerDivRef} className="w-full h-full"></div>
              
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/95 to-transparent">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full mb-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold">Scanning...</span>
                  </div>
                  <p className="text-white text-base font-medium">Position barcode within green frame</p>
                  <p className="text-white/70 text-sm mt-2">Hold steady • Good lighting helps</p>
                </div>
              </div>
            </>
          )}
          
          <style>{`
            #qr-reader {
              width: 100% !important;
              height: 100% !important;
            }
            #qr-reader__dashboard_section {
              display: none !important;
            }
            #qr-reader__camera_selection {
              display: none !important;
            }
            #qr-reader video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          `}</style>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Scan Parts</h1>
        <p className="text-slate-600">Scan barcode or search for parts</p>
      </div>

      {/* Primary: Manual Barcode Entry */}
      <Card className="border-0 shadow-xl bg-white">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <ScanBarcode className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#1E293B' }}>Enter or Paste Barcode</h2>
            <p className="text-sm" style={{ color: '#64748B' }}>Type or paste the barcode number below</p>
          </div>

          <div className="space-y-4">
            <Input
              placeholder="Type or paste barcode here..."
              value={manualEntry}
              onChange={(e) => setManualEntry(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && manualEntry.trim() && handleManualScan()}
              className="h-16 text-xl font-mono text-center"
              autoFocus
            />
            <Button 
              onClick={handleManualScan}
              disabled={!manualEntry.trim() || loading}
              size="lg"
              className="w-full h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <Check className="w-6 h-6 mr-2" />
                  Submit Barcode
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <Button 
              onClick={() => {
                setShowScanner(true);
              }}
              variant="outline"
              size="lg"
              className="w-full h-14"
            >
              <Camera className="w-5 h-5 mr-2" />
              Use Device Camera (Optional)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Test Barcodes */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-4">
          <p className="text-xs text-amber-700 font-medium mb-3">🧪 Quick Test:</p>
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

      {/* Part Search */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Parts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name, number, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-12"
            />
            <Button onClick={handleSearch} className="h-12 px-6 bg-blue-600 hover:bg-blue-700" disabled={searching}>
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Raw Stock */}
                  <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-200">
                    <div className="text-xs text-amber-700 mb-1 font-medium">Raw / Blanks</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-amber-600">{scannedPart.raw_stock || 0}</span>
                      <span className="text-sm text-amber-600">{scannedPart.unit || 'pcs'}</span>
                    </div>
                  </div>
                  
                  {/* Finished Stock */}
                  <div className={`p-4 rounded-xl ${isLowStock ? 'bg-red-50 border-2 border-red-300' : 'bg-green-50 border-2 border-green-200'}`}>
                    <div className="text-xs mb-1 font-medium flex items-center justify-between">
                      <span className={isLowStock ? 'text-red-700' : 'text-green-700'}>Finished</span>
                      {isLowStock && <AlertTriangle className="w-3 h-3 text-red-600" />}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                        {scannedPart.finished_stock || 0}
                      </span>
                      <span className={`text-sm ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>{scannedPart.unit || 'pcs'}</span>
                    </div>
                  </div>
                </div>

                {scannedPart.allow_sym_opp && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-xs text-blue-700 mb-1 font-medium">LH Finished</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-blue-600">{scannedPart.lh_stock || 0}</span>
                        <span className="text-xs text-blue-600">{scannedPart.unit || 'pcs'}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-xs text-blue-700 mb-1 font-medium">RH Finished</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-blue-600">{scannedPart.rh_stock || 0}</span>
                        <span className="text-xs text-blue-600">{scannedPart.unit || 'pcs'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {scannedPart.min_stock_level && (
                  <p className="text-xs text-slate-500">
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
                {fixingDetails.length > 0 && (
                  <div className="col-span-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowFixings(!showFixings)}
                      className="w-full h-14 border-2 border-blue-200 hover:bg-blue-50"
                    >
                      <Wrench className="w-5 h-5 mr-2 text-blue-600" />
                      <span className="font-semibold text-blue-700">
                        View Required Fixings ({fixingDetails.length})
                      </span>
                      <span className="ml-auto text-blue-600">{showFixings ? '−' : '+'}</span>
                    </Button>
                    
                    {showFixings && (
                      <div className="mt-3 space-y-2 border-2 border-blue-100 rounded-xl p-3 bg-blue-50/50">
                        {fixingDetails.map((fixing, idx) => {
                          const isLowStock = fixing.min_stock_level && fixing.current_stock < fixing.min_stock_level;
                          return (
                            <div 
                              key={idx} 
                              className={`p-4 rounded-lg border-2 ${
                                isLowStock 
                                  ? 'bg-amber-50 border-amber-300' 
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-semibold text-base text-slate-900">{fixing.fixing_name}</p>
                                  <p className="text-sm text-slate-500 font-mono">{fixing.sku}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-blue-600">{fixing.quantity_per_unit}x</p>
                                  <p className="text-xs text-slate-500">per unit</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                {fixing.location && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Location</p>
                                    <p className="text-sm font-medium text-slate-900 flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {fixing.location}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Current Stock</p>
                                  <p className={`text-sm font-bold ${isLowStock ? 'text-amber-600' : 'text-green-600'}`}>
                                    {fixing.current_stock} {fixing.unit || 'pcs'}
                                  </p>
                                </div>
                              </div>
                              
                              {isLowStock && (
                                <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-100 px-3 py-2 rounded-lg">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                  <span className="text-sm font-medium">Low stock – reorder suggested</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                    className="h-20 text-base flex-col gap-1 border-2 border-amber-300 hover:bg-amber-50"
                  >
                    <Plus className="w-6 h-6 text-amber-600" />
                    <span className="text-amber-900 font-semibold">Add Raw Stock</span>
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
              <Label>Quantity</Label>
              <Input
                type="number"
                value={wipForm.quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  const totalQty = parseInt(val) || 0;
                  setWipForm({ 
                    ...wipForm, 
                    quantity: val,
                    lh_quantity: scannedPart?.allow_sym_opp ? totalQty : '',
                    rh_quantity: scannedPart?.allow_sym_opp ? '0' : ''
                  });
                }}
                placeholder="Enter quantity"
                className="mt-1 h-12"
                min="1"
              />
            </div>

            {scannedPart?.allow_sym_opp && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>LH Quantity</Label>
                    <Input
                      type="number"
                      value={wipForm.lh_quantity}
                      onChange={(e) => setWipForm({ ...wipForm, lh_quantity: e.target.value })}
                      placeholder="0"
                      className="mt-1 h-12"
                      style={{ borderColor: '#3B82F6', borderWidth: '2px' }}
                      min="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">→ Will add to {scannedPart.part_number}</p>
                  </div>
                  <div>
                    <Label>RH Quantity</Label>
                    <Input
                      type="number"
                      value={wipForm.rh_quantity}
                      onChange={(e) => setWipForm({ ...wipForm, rh_quantity: e.target.value })}
                      placeholder="0"
                      className="mt-1 h-12"
                      style={{ borderColor: '#10B981', borderWidth: '2px' }}
                      min="0"
                    />
                    {scannedPart.rh_part_number && (
                      <p className="text-xs text-slate-500 mt-1">→ Will add to {scannedPart.rh_part_number}</p>
                    )}
                    {!scannedPart.rh_part_number && (
                      <p className="text-xs text-red-500 mt-1">⚠️ RH not configured</p>
                    )}
                  </div>
                </div>
                
                {parseInt(wipForm.rh_quantity || 0) > 0 && scannedPart.rh_part_number && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700">
                      <span className="font-semibold">RH will be added to:</span> {scannedPart.rh_part_number}{scannedPart.rh_part_name ? ` – ${scannedPart.rh_part_name}` : ''}
                    </p>
                  </div>
                )}
              </div>
            )}
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

      {/* Add Raw Stock Dialog */}
      <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-amber-600" />
              </div>
              Add Raw Stock / Blanks
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900 font-medium">📦 Receiving unworked parts</p>
              <p className="text-xs text-amber-700 mt-1">This adds raw materials/blanks that haven't been processed yet</p>
            </div>
            
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
                placeholder="e.g., New delivery, supplier name..."
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