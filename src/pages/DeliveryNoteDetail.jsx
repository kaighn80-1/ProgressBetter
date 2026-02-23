import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  FileText, 
  Printer, 
  Download,
  CheckCircle2,
  Clock,
  Send,
  Package,
  MapPin,
  Calendar,
  ArrowLeft,
  Edit,
  User,
  FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

export default function DeliveryNoteDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState(null);
  const [user, setUser] = useState(null);
  
  // Get note ID from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const noteId = searchParams.get('id');

  useEffect(() => {
    if (!noteId) {
      toast.error('No delivery note ID provided');
      navigate(createPageUrl('DeliveryNotes'));
      return;
    }
    loadNote();
  }, [noteId]);

  const loadNote = async () => {
    try {
      const [userData, notes] = await Promise.all([
        base44.auth.me(),
        base44.entities.DeliveryNote.list()
      ]);
      
      const foundNote = notes.find(n => n.id === noteId);
      if (!foundNote) {
        toast.error('Delivery note not found');
        navigate(createPageUrl('DeliveryNotes'));
        return;
      }
      
      setUser(userData);
      setNote(foundNote);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load delivery note');
      navigate(createPageUrl('DeliveryNotes'));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSent = async () => {
    try {
      await base44.entities.DeliveryNote.update(note.id, { status: 'sent' });
      toast.success('Marked as sent');
      loadNote();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleMarkAsDelivered = async () => {
    try {
      await base44.entities.DeliveryNote.update(note.id, { status: 'delivered' });
      toast.success('Marked as delivered');
      loadNote();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('DELIVERY NOTE', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Note #: ${note.delivery_note_number}`, 20, 35);
      doc.text(`Date: ${format(new Date(note.delivery_date), 'MMM d, yyyy')}`, 20, 42);
      doc.text(`Status: ${note.status.toUpperCase()}`, 20, 49);
      
      // Project Info
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Project:', 20, 62);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(note.project_name || 'N/A', 20, 69);
      
      // Address Info
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Delivery Address:', 20, 82);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(note.delivery_address_name || 'N/A', 20, 89);
      const addressLines = (note.delivery_address_full || '').split('\n');
      addressLines.forEach((line, idx) => {
        doc.text(line, 20, 96 + (idx * 7));
      });
      
      let yPos = 96 + (addressLines.length * 7) + 10;
      if (note.delivery_contact) {
        doc.text(`Contact: ${note.delivery_contact}`, 20, yPos);
        yPos += 7;
      }
      
      // Parts/Assemblies Table
      yPos += 8;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Items:', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Item', 20, yPos);
      doc.text('Description', 70, yPos);
      doc.text('Qty', 170, yPos);
      yPos += 7;
      
      doc.setFont(undefined, 'normal');
      (note.selected_parts || []).forEach((item) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        const itemNumber = item.type === 'assembly' ? item.assembly_number : item.part_number;
        const itemName = item.type === 'assembly' ? item.assembly_name : item.part_name;
        
        doc.text(itemNumber || 'N/A', 20, yPos);
        doc.text(itemName || 'N/A', 70, yPos);
        doc.text(String(item.quantity || 0), 170, yPos);
        yPos += 7;
      });
      
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.text(`Total Quantity: ${note.total_quantity || 0}`, 20, yPos);
      
      // Notes
      if (note.notes) {
        yPos += 15;
        doc.setFontSize(12);
        doc.text('Notes:', 20, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const noteLines = doc.splitTextToSize(note.notes, 170);
        noteLines.forEach((line) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 7;
        });
      }
      
      // Footer
      yPos = 280;
      doc.setFontSize(8);
      doc.text(`Generated by: ${note.generated_by_name || 'N/A'}`, 20, yPos);
      doc.text(`Date: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 150, yPos);
      
      doc.save(`DeliveryNote_${note.delivery_note_number}.pdf`);
      toast.success('PDF exported successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Item Type', 'Item Number', 'Item Name', 'Quantity', 'Unit'];
      const rows = (note.selected_parts || []).map(item => [
        item.type === 'assembly' ? 'Assembly' : 'Part',
        item.type === 'assembly' ? item.assembly_number : item.part_number,
        item.type === 'assembly' ? item.assembly_name : item.part_name,
        item.quantity || 0,
        item.unit || 'pcs'
      ]);
      
      const csvContent = [
        ['Delivery Note', note.delivery_note_number],
        ['Date', format(new Date(note.delivery_date), 'yyyy-MM-dd')],
        ['Project', note.project_name],
        ['Status', note.status],
        ['Address', note.delivery_address_name],
        [''],
        headers,
        ...rows,
        [''],
        ['Total Quantity', note.total_quantity || 0]
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DeliveryNote_${note.delivery_note_number}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('CSV exported successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export CSV');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: { bg: '#F1F5F9', color: '#64748B', icon: Clock },
      generated: { bg: '#DBEAFE', color: '#1E40AF', icon: FileText },
      sent: { bg: '#FED7AA', color: '#92400E', icon: Send },
      delivered: { bg: '#D1FAE5', color: '#065F46', icon: CheckCircle2 }
    };
    const style = styles[status] || styles.draft;
    const Icon = style.icon;
    return (
      <Badge style={{ backgroundColor: style.bg, color: style.color }} className="text-base px-3 py-1.5">
        <Icon className="w-4 h-4 mr-2" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: '#CBD5E1' }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E293B' }}>Delivery note not found</h3>
        <Button onClick={() => navigate(createPageUrl('DeliveryNotes'))} style={{ backgroundColor: '#3B82F6', color: 'white' }}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Delivery Notes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl('DeliveryNotes'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#1E293B' }}>
              {note.delivery_note_number}
            </h1>
            <p style={{ color: '#64748B' }}>Delivery Note Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(note.status)}
        </div>
      </div>

      {/* Action Buttons */}
      <Card className="border-0 shadow-md print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleExportPDF} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={handleExportCSV} variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {note.status === 'generated' && (
              <Button onClick={handleMarkAsSent} style={{ backgroundColor: '#F59E0B', color: 'white' }}>
                <Send className="w-4 h-4 mr-2" />
                Mark as Sent
              </Button>
            )}
            {note.status === 'sent' && (
              <Button onClick={handleMarkAsDelivered} style={{ backgroundColor: '#10B981', color: 'white' }}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Delivered
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Details */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Project & Date Info */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: '#3B82F6' }} />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Project</p>
              <p className="text-lg font-bold" style={{ color: '#1E293B' }}>{note.project_name || 'N/A'}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Delivery Date</p>
              <p className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1E293B' }}>
                <Calendar className="w-5 h-5" style={{ color: '#3B82F6' }} />
                {format(new Date(note.delivery_date), 'MMMM d, yyyy')}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Created By</p>
              <p className="text-base font-medium flex items-center gap-2" style={{ color: '#1E293B' }}>
                <User className="w-4 h-4" style={{ color: '#3B82F6' }} />
                {note.generated_by_name || 'N/A'}
              </p>
              <p className="text-sm" style={{ color: '#94A3B8' }}>{note.generated_by_email || ''}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Created On</p>
              <p className="text-base font-medium" style={{ color: '#1E293B' }}>
                {format(new Date(note.created_date), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" style={{ color: '#10B981' }} />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Address Name</p>
              <p className="text-lg font-bold" style={{ color: '#1E293B' }}>{note.delivery_address_name || 'N/A'}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Full Address</p>
              <p className="text-base font-medium whitespace-pre-wrap" style={{ color: '#1E293B' }}>
                {note.delivery_address_full || 'N/A'}
              </p>
            </div>
            {note.delivery_contact && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Contact Information</p>
                  <p className="text-base font-medium" style={{ color: '#1E293B' }}>{note.delivery_contact}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: '#F59E0B' }} />
            Items to Deliver
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th className="text-left p-3 font-semibold text-sm" style={{ color: '#64748B' }}>Type</th>
                  <th className="text-left p-3 font-semibold text-sm" style={{ color: '#64748B' }}>Item Number</th>
                  <th className="text-left p-3 font-semibold text-sm" style={{ color: '#64748B' }}>Item Name</th>
                  <th className="text-right p-3 font-semibold text-sm" style={{ color: '#64748B' }}>Quantity</th>
                  <th className="text-center p-3 font-semibold text-sm" style={{ color: '#64748B' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {(note.selected_parts || []).map((item, idx) => (
                  <tr key={idx} className="border-t" style={{ borderColor: '#E2E8F0' }}>
                    <td className="p-3">
                      <Badge variant="outline" style={{ 
                        backgroundColor: item.type === 'assembly' ? '#EEF2FF' : '#FEF3C7',
                        color: item.type === 'assembly' ? '#4338CA' : '#92400E',
                        borderColor: 'transparent'
                      }}>
                        {item.type === 'assembly' ? 'Assembly' : 'Part'}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold" style={{ color: '#1E293B' }}>
                      {item.type === 'assembly' ? item.assembly_number : item.part_number}
                    </td>
                    <td className="p-3 font-medium" style={{ color: '#1E293B' }}>
                      {item.type === 'assembly' ? item.assembly_name : item.part_name}
                      {item.type === 'assembly' && item.required_parts && item.required_parts.length > 0 && (
                        <div className="mt-2 text-xs p-2 rounded bg-slate-50" style={{ borderLeft: '3px solid #3B82F6' }}>
                          <p className="font-semibold text-slate-600 mb-1">Required Parts:</p>
                          {item.required_parts.map((req, i) => (
                            <p key={i} className="text-slate-600">• {req.part_number} - {req.part_name} (qty: {req.quantity_needed})</p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-lg" style={{ color: '#10B981' }}>
                      {item.quantity || 0}
                    </td>
                    <td className="p-3 text-center text-sm" style={{ color: '#64748B' }}>
                      {item.unit || 'pcs'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #CBD5E1' }}>
                  <td colSpan="3" className="p-3 font-bold text-lg" style={{ color: '#1E293B' }}>Total</td>
                  <td className="p-3 text-right font-bold text-2xl" style={{ color: '#10B981' }}>
                    {note.total_quantity || 0}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {note.notes && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap" style={{ color: '#475569' }}>{note.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}