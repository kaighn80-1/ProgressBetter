import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  FileText, 
  Printer, 
  Download,
  RefreshCw,
  Package,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Box,
  TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';

export default function FullStockTakeReport() {
  const [parts, setParts] = useState([]);
  const [fixings, setFixings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const [wips, setWips] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [partsData, fixingsData, projectsData, wipsData] = await Promise.all([
        base44.entities.Part.list('part_name'),
        base44.entities.Fixing.list('fixing_name'),
        base44.entities.Project.list(),
        base44.entities.WorkInProgress.filter({ status: 'active' })
      ]);
      
      // Calculate WIP quantities by part
      const wipByPart = {};
      wipsData.forEach(wip => {
        if (!wipByPart[wip.part_id]) wipByPart[wip.part_id] = 0;
        wipByPart[wip.part_id] += wip.quantity || 0;
      });
      
      // Add WIP quantities to parts
      const partsWithWip = partsData.map(p => ({
        ...p,
        wip_quantity: wipByPart[p.id] || 0
      }));
      
      setParts(partsWithWip);
      setFixings(fixingsData);
      setProjects(projectsData);
      setWips(wipsData);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    setReportGenerated(true);
    setGeneratedAt(new Date());
    toast.success('📊 Report ready — click Print or Export');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csvContent = `Progress Better - Full Stock Take Report\n`;
    csvContent += `Generated: ${format(new Date(), 'PPP p')}\n\n`;
    
    // Parts Section
    csvContent += `PARTS INVENTORY\n`;
    csvContent += `Part Name,Part Number,Project,Subsection,Blank Qty,Finished Qty,WIP,Total Stock,Min Stock,Reorder Qty,Location,Last Counted,Status\n`;
    
    parts.forEach(part => {
      const isLowStock = part.min_stock_level && (part.finished_stock || 0) < part.min_stock_level;
      const totalStock = (part.raw_stock || 0) + (part.finished_stock || 0);
      const status = isLowStock ? 'LOW STOCK' : 'OK';
      csvContent += `"${part.part_name}","${part.part_number}","${part.project_name || ''}","${part.subsection_name || ''}",${part.raw_stock || 0},${part.finished_stock || 0},${part.wip_quantity || 0},${totalStock},${part.min_stock_level || 0},${part.reorder_quantity || 0},"${part.location || ''}","${part.last_counted_date || ''}",${status}\n`;
    });
    
    csvContent += `\n\nFIXINGS INVENTORY\n`;
    csvContent += `Fixing Name,SKU,Category,Current Stock,Min Stock,Reorder Qty,Location,Last Counted,Status\n`;
    
    fixings.forEach(fixing => {
      const isLowStock = fixing.min_stock_level && (fixing.current_stock || 0) < fixing.min_stock_level;
      const status = isLowStock ? 'LOW STOCK' : 'OK';
      csvContent += `"${fixing.fixing_name}","${fixing.sku}","${fixing.category || ''}",${fixing.current_stock || 0},${fixing.min_stock_level || 0},${fixing.reorder_quantity || 0},"${fixing.location || ''}","${fixing.last_counted_date || ''}",${status}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-stock-take-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  const lowStockParts = parts.filter(p => p.min_stock_level && (p.finished_stock || 0) < p.min_stock_level);
  const lowStockFixings = fixings.filter(f => f.min_stock_level && (f.current_stock || 0) < f.min_stock_level);
  const totalLowStock = lowStockParts.length + lowStockFixings.length;
  const totalStock = parts.reduce((sum, p) => sum + (p.finished_stock || 0), 0);
  const totalFixingsStock = fixings.reduce((sum, f) => sum + (f.current_stock || 0), 0);

  // Group parts by project
  const partsByProject = projects.reduce((acc, project) => {
    acc[project.id] = {
      projectName: project.project_name,
      parts: parts.filter(p => p.project_id === project.id)
    };
    return acc;
  }, {});
  
  // Unassigned parts
  const unassignedParts = parts.filter(p => !p.project_id);

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 print:pb-0">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-page-break {
            page-break-after: always;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header - No Print */}
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1E293B' }}>Full Stock Take Report</h1>
          <p style={{ color: '#64748B' }}>Complete inventory snapshot for all parts and fixings</p>
        </div>
        <Button 
          onClick={loadData}
          variant="outline"
          style={{ borderColor: '#E2E8F0' }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {!reportGenerated ? (
        <Card className="no-print border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="w-20 h-20 mx-auto mb-4" style={{ color: '#3B82F6' }} />
            <h2 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
              Ready to Generate Report
            </h2>
            <p className="mb-6 text-lg" style={{ color: '#64748B' }}>
              This will generate a printable full stock take report including all {parts.length} parts and {fixings.length} fixings
            </p>
            <Button 
              size="lg"
              onClick={handleGenerateReport}
              className="text-lg px-8 py-6"
              style={{ backgroundColor: '#3B82F6', color: 'white' }}
            >
              <FileText className="w-5 h-5 mr-2" />
              Generate Full Stock Take Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action Buttons - No Print */}
          <div className="no-print flex flex-wrap gap-3">
            <Button 
              size="lg"
              onClick={handlePrint}
              style={{ backgroundColor: '#3B82F6', color: 'white' }}
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Report
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={handleExportCSV}
              style={{ borderColor: '#10B981', color: '#10B981' }}
            >
              <Download className="w-5 h-5 mr-2" />
              Export CSV
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => {
                setReportGenerated(false);
                setGeneratedAt(null);
              }}
            >
              Back to Setup
            </Button>
          </div>

          {/* Printable Report Area */}
          <div className="print-area">
            {/* Report Header */}
            <div className="text-center mb-8 print:mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Package className="w-8 h-8 print:w-10 print:h-10" style={{ color: '#3B82F6' }} />
                <h1 className="text-3xl print:text-4xl font-bold" style={{ color: '#1E293B' }}>
                  Progress Better
                </h1>
              </div>
              <h2 className="text-xl print:text-2xl font-semibold mb-2" style={{ color: '#3B82F6' }}>
                Full Stock Take Report
              </h2>
              <p className="text-sm print:text-base" style={{ color: '#64748B' }}>
                Stock Take as of {generatedAt ? format(generatedAt, 'PPPP p') : format(new Date(), 'PPPP p')}
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 print:mb-6">
              <Card className="border shadow-sm print:shadow-none">
                <CardContent className="p-4 print:p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 print:w-8 print:h-8 rounded-lg flex items-center justify-center" 
                      style={{ backgroundColor: '#E0E7FF' }}>
                      <Package className="w-5 h-5 print:w-4 print:h-4" style={{ color: '#3B82F6' }} />
                    </div>
                    <div>
                      <p className="text-xl print:text-lg font-bold" style={{ color: '#1E293B' }}>{parts.length}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>Total Parts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm print:shadow-none">
                <CardContent className="p-4 print:p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 print:w-8 print:h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#E0E7FF' }}>
                      <Wrench className="w-5 h-5 print:w-4 print:h-4" style={{ color: '#3B82F6' }} />
                    </div>
                    <div>
                      <p className="text-xl print:text-lg font-bold" style={{ color: '#1E293B' }}>{fixings.length}</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>Total Fixings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm print:shadow-none">
                <CardContent className="p-4 print:p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 print:w-8 print:h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#D1FAE5' }}>
                      <Box className="w-5 h-5 print:w-4 print:h-4" style={{ color: '#10B981' }} />
                    </div>
                    <div>
                      <p className="text-xl print:text-lg font-bold" style={{ color: '#1E293B' }}>
                        {(totalStock + totalFixingsStock).toLocaleString()}
                      </p>
                      <p className="text-xs" style={{ color: '#64748B' }}>Total Units</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border shadow-sm print:shadow-none ${totalLowStock > 0 ? 'border-l-4' : ''}`}
                style={totalLowStock > 0 ? { borderLeftColor: '#F59E0B' } : {}}>
                <CardContent className="p-4 print:p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 print:w-8 print:h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: totalLowStock > 0 ? '#FED7AA' : '#F1F5F9' }}>
                      <AlertTriangle className="w-5 h-5 print:w-4 print:h-4" 
                        style={{ color: totalLowStock > 0 ? '#F59E0B' : '#CBD5E1' }} />
                    </div>
                    <div>
                      <p className="text-xl print:text-lg font-bold" 
                        style={{ color: totalLowStock > 0 ? '#F59E0B' : '#1E293B' }}>
                        {totalLowStock}
                      </p>
                      <p className="text-xs" style={{ color: '#64748B' }}>Low Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm print:shadow-none">
                <CardContent className="p-4 print:p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 print:w-8 print:h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#D1FAE5' }}>
                      <CheckCircle2 className="w-5 h-5 print:w-4 print:h-4" style={{ color: '#10B981' }} />
                    </div>
                    <div>
                      <p className="text-xl print:text-lg font-bold" style={{ color: '#1E293B' }}>
                        {parts.length + fixings.length - totalLowStock}
                      </p>
                      <p className="text-xs" style={{ color: '#64748B' }}>Healthy</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Parts Section */}
            <div className="mb-8 print:mb-6">
              <h3 className="text-2xl print:text-xl font-bold mb-4 print:mb-3 flex items-center gap-2" 
                style={{ color: '#1E293B' }}>
                <Package className="w-6 h-6" style={{ color: '#3B82F6' }} />
                Parts Inventory ({parts.length})
              </h3>

              {/* Parts by Project */}
              {Object.entries(partsByProject).map(([projectId, { projectName, parts: projectParts }]) => {
                if (projectParts.length === 0) return null;
                return (
                  <div key={projectId} className="mb-6 print:mb-4">
                    <h4 className="font-semibold mb-3 text-lg print:text-base px-3 py-2 rounded-lg"
                      style={{ backgroundColor: '#F8FAFC', color: '#1E293B' }}>
                      {projectName} ({projectParts.length} parts)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm print:text-xs">
                        <thead>
                          <tr style={{ backgroundColor: '#F1F5F9' }}>
                            <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Part Name</th>
                            <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Part Number</th>
                            <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Subsection</th>
                            <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Blank Qty</th>
                            <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Finished</th>
                            <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>WIP</th>
                            <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Min</th>
                            <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Reorder</th>
                            <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Location</th>
                            <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectParts.map(part => {
                            const isLowStock = part.min_stock_level && (part.finished_stock || 0) < part.min_stock_level;
                            const isLowBlank = part.min_stock_level && (part.raw_stock || 0) < part.min_stock_level;
                            return (
                              <tr key={part.id} className={isLowStock ? 'print:bg-amber-50' : ''}
                                style={isLowStock ? { backgroundColor: '#FEF3C7' } : {}}>
                                <td className="p-2 print:p-1 border font-medium">{part.part_name}</td>
                                <td className="p-2 print:p-1 border font-mono text-xs">{part.part_number}</td>
                                <td className="p-2 print:p-1 border text-xs">{part.subsection_name || '-'}</td>
                                <td className="p-2 print:p-1 border text-center font-bold"
                                  style={{ color: isLowBlank ? '#F59E0B' : '#64748B' }}>
                                  {part.raw_stock || 0}
                                </td>
                                <td className="p-2 print:p-1 border text-center font-bold"
                                  style={{ color: isLowStock ? '#F59E0B' : '#1E293B' }}>
                                  {part.finished_stock || 0}
                                </td>
                                <td className="p-2 print:p-1 border text-center text-blue-600 font-medium">
                                  {part.wip_quantity || 0}
                                </td>
                                <td className="p-2 print:p-1 border text-center">{part.min_stock_level || '-'}</td>
                                <td className="p-2 print:p-1 border text-center">{part.reorder_quantity || '-'}</td>
                                <td className="p-2 print:p-1 border text-xs">{part.location || '-'}</td>
                                <td className="p-2 print:p-1 border text-center">
                                  {isLowStock ? (
                                    <Badge className="print:text-xs" 
                                      style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}>
                                      LOW
                                    </Badge>
                                  ) : (
                                    <Badge className="print:text-xs"
                                      style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                      OK
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Unassigned Parts */}
              {unassignedParts.length > 0 && (
                <div className="mb-6 print:mb-4">
                  <h4 className="font-semibold mb-3 text-lg print:text-base px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#F8FAFC', color: '#1E293B' }}>
                    Unassigned Parts ({unassignedParts.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm print:text-xs">
                      <thead>
                        <tr style={{ backgroundColor: '#F1F5F9' }}>
                          <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Part Name</th>
                          <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Part Number</th>
                          <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Blank Qty</th>
                          <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Finished</th>
                          <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>WIP</th>
                          <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Min</th>
                          <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Reorder</th>
                          <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Location</th>
                          <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unassignedParts.map(part => {
                          const isLowStock = part.min_stock_level && (part.finished_stock || 0) < part.min_stock_level;
                          const isLowBlank = part.min_stock_level && (part.raw_stock || 0) < part.min_stock_level;
                          return (
                            <tr key={part.id} className={isLowStock ? 'print:bg-amber-50' : ''}
                              style={isLowStock ? { backgroundColor: '#FEF3C7' } : {}}>
                              <td className="p-2 print:p-1 border font-medium">{part.part_name}</td>
                              <td className="p-2 print:p-1 border font-mono text-xs">{part.part_number}</td>
                              <td className="p-2 print:p-1 border text-center font-bold"
                                style={{ color: isLowBlank ? '#F59E0B' : '#64748B' }}>
                                {part.raw_stock || 0}
                              </td>
                              <td className="p-2 print:p-1 border text-center font-bold"
                                style={{ color: isLowStock ? '#F59E0B' : '#1E293B' }}>
                                {part.finished_stock || 0}
                              </td>
                              <td className="p-2 print:p-1 border text-center text-blue-600 font-medium">
                                {part.wip_quantity || 0}
                              </td>
                              <td className="p-2 print:p-1 border text-center">{part.min_stock_level || '-'}</td>
                              <td className="p-2 print:p-1 border text-center">{part.reorder_quantity || '-'}</td>
                              <td className="p-2 print:p-1 border text-xs">{part.location || '-'}</td>
                              <td className="p-2 print:p-1 border text-center">
                                {isLowStock ? (
                                  <Badge className="print:text-xs"
                                    style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}>
                                    LOW
                                  </Badge>
                                ) : (
                                  <Badge className="print:text-xs"
                                    style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                    OK
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Fixings Section */}
            <div className="print-page-break mb-8 print:mb-6">
              <h3 className="text-2xl print:text-xl font-bold mb-4 print:mb-3 flex items-center gap-2"
                style={{ color: '#1E293B' }}>
                <Wrench className="w-6 h-6" style={{ color: '#3B82F6' }} />
                Fixings Inventory ({fixings.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm print:text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9' }}>
                      <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Fixing Name</th>
                      <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>SKU</th>
                      <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Category</th>
                      <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Stock</th>
                      <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Min</th>
                      <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Reorder</th>
                      <th className="text-left p-2 print:p-1 border" style={{ color: '#64748B' }}>Location</th>
                      <th className="text-center p-2 print:p-1 border" style={{ color: '#64748B' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixings.map(fixing => {
                      const isLowStock = fixing.min_stock_level && (fixing.current_stock || 0) < fixing.min_stock_level;
                      return (
                        <tr key={fixing.id} className={isLowStock ? 'print:bg-amber-50' : ''}
                          style={isLowStock ? { backgroundColor: '#FEF3C7' } : {}}>
                          <td className="p-2 print:p-1 border font-medium">{fixing.fixing_name}</td>
                          <td className="p-2 print:p-1 border font-mono text-xs">{fixing.sku}</td>
                          <td className="p-2 print:p-1 border text-xs">{fixing.category || '-'}</td>
                          <td className="p-2 print:p-1 border text-center font-bold"
                            style={{ color: isLowStock ? '#F59E0B' : '#1E293B' }}>
                            {fixing.current_stock || 0}
                          </td>
                          <td className="p-2 print:p-1 border text-center">{fixing.min_stock_level || '-'}</td>
                          <td className="p-2 print:p-1 border text-center">{fixing.reorder_quantity || '-'}</td>
                          <td className="p-2 print:p-1 border text-xs">{fixing.location || '-'}</td>
                          <td className="p-2 print:p-1 border text-center">
                            {isLowStock ? (
                              <Badge className="print:text-xs"
                                style={{ backgroundColor: '#F59E0B', color: '#1E293B' }}>
                                LOW
                              </Badge>
                            ) : (
                              <Badge className="print:text-xs"
                                style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                OK
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 print:mt-6 pt-6 print:pt-4 border-t text-center" style={{ borderColor: '#E2E8F0' }}>
              <p className="text-sm print:text-xs" style={{ color: '#64748B' }}>
                This report is a snapshot of current stock levels at the time of generation.
              </p>
              <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                Progress Better Manufacturing & Inventory Management System
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}