/**
 * Daily Low Stock Report - Automated Email
 * 
 * Runs daily at 5:00 PM to check inventory and send low stock alerts
 * 
 * Configuration:
 * - Edit RECIPIENTS array to add/remove email addresses
 * - Edit REPORT_TIME in automation settings to change schedule
 * - Stock threshold uses each part's min_stock_level field
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
  
  // ===== CONFIGURATION =====
  const RECIPIENTS = [
    'phumphreys@tecniq.co.uk',
    // Add more recipients here:
    // 'supervisor@yourcompany.com',
  ];
  
  const COMPANY_NAME = 'Progress Better';
  
  try {
    console.log('🔍 Starting daily low stock report...');
    
    // Query all parts with low raw stock
    const allParts = await base44.entities.Part.list();
    const lowStockParts = allParts.filter(p => 
      p.min_stock_level && (p.raw_stock || 0) < p.min_stock_level
    );
    
    console.log(`Found ${lowStockParts.length} low stock items`);
    
    // Format current date
    const today = new Date().toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Generate email subject
    const subject = `📦 End of Day Low Stock Report - ${today}`;
    
    // If no low stock items, send positive report
    if (lowStockParts.length === 0) {
      const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #10B981; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ ${COMPANY_NAME} - End of Day Stock Report</h1>
    <p style="margin: 5px 0 0 0;">${today}</p>
  </div>
  
  <div class="content">
    <h2 style="color: #10B981; margin-top: 0;">All Stock Levels OK</h2>
    <p>Great news! All parts are currently above their minimum stock levels.</p>
    <p><strong>No action required.</strong></p>
  </div>
  
  <div class="footer">
    <p>This is an automated report from ${COMPANY_NAME} Inventory Management System</p>
  </div>
</body>
</html>
      `.trim();
      
      // Send to all recipients
      for (const recipient of RECIPIENTS) {
        await base44.integrations.Core.SendEmail({
          to: recipient,
          from_name: `${COMPANY_NAME} Inventory`,
          subject: subject.replace('📦', '✅'),
          body: body
        });
      }
      
      console.log('✅ Positive report sent successfully');
      return Response.json({ success: true, message: 'All stock OK - positive report sent', count: 0 });
    }
    
    // Sort by shortfall (most urgent first)
    lowStockParts.sort((a, b) => {
      const shortfallA = (a.min_stock_level || 0) - (a.raw_stock || 0);
      const shortfallB = (b.min_stock_level || 0) - (b.raw_stock || 0);
      return shortfallB - shortfallA;
    });
    
    // Calculate totals
    const totalShortfall = lowStockParts.reduce((sum, p) => 
      sum + ((p.min_stock_level || 0) - (p.raw_stock || 0)), 0
    );
    
    // Generate HTML table rows
    const tableRows = lowStockParts.map((part, index) => {
      const currentStock = part.raw_stock || 0;
      const minLevel = part.min_stock_level || 0;
      const shortfall = minLevel - currentStock;
      const reorderQty = part.reorder_quantity || minLevel;
      const urgency = shortfall >= minLevel ? 'critical' : shortfall >= minLevel * 0.5 ? 'high' : 'medium';
      
      return `
        <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1e293b;">${part.part_number || 'N/A'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${part.part_name || 'N/A'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="color: #ef4444; font-weight: bold;">${currentStock}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${minLevel}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="color: #dc2626; font-weight: bold;">-${shortfall}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #10b981; font-weight: bold;">${reorderQty}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              background: ${urgency === 'critical' ? '#fee2e2' : urgency === 'high' ? '#fed7aa' : '#fef3c7'};
              color: ${urgency === 'critical' ? '#991b1b' : urgency === 'high' ? '#9a3412' : '#92400e'};
            ">${urgency}</span>
          </td>
        </tr>
      `;
    }).join('');
    
    // Generate full HTML email
    const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .summary { display: flex; gap: 15px; margin-bottom: 20px; }
    .summary-card { flex: 1; background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
    .summary-card.alert { border-color: #f59e0b; background: #fffbeb; }
    .summary-card h3 { margin: 0 0 5px 0; font-size: 28px; color: #ef4444; }
    .summary-card p { margin: 0; color: #6b7280; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #1e293b; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 12px; text-transform: uppercase; }
    th.center { text-align: center; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .action-required { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚠️ ${COMPANY_NAME} - Low Stock Alert</h1>
    <p style="margin: 5px 0 0 0;">${today}</p>
  </div>
  
  <div class="summary">
    <div class="summary-card alert">
      <h3>${lowStockParts.length}</h3>
      <p>Parts Below Minimum</p>
    </div>
    <div class="summary-card">
      <h3 style="color: #dc2626;">${totalShortfall}</h3>
      <p>Total Units Short</p>
    </div>
  </div>
  
  <div class="action-required">
    <strong>⚡ Action Required:</strong> The following parts need reordering to maintain production capacity.
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Part Number</th>
        <th>Part Name</th>
        <th class="center">Current<br/>Raw Stock</th>
        <th class="center">Min<br/>Level</th>
        <th class="center">Shortfall</th>
        <th class="center">Reorder<br/>Qty</th>
        <th class="center">Urgency</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>Note:</strong> This report shows parts where <em>raw stock</em> is below minimum levels. Finished stock is not included in alerts.</p>
    <p>This is an automated daily report from ${COMPANY_NAME} Inventory Management System.</p>
    <p style="margin-top: 10px;">To modify recipients or schedule, edit the <code>sendDailyLowStockReport</code> backend function.</p>
  </div>
</body>
</html>
    `.trim();
    
    // Send to all recipients
    for (const recipient of RECIPIENTS) {
      await base44.integrations.Core.SendEmail({
        to: recipient,
        from_name: `${COMPANY_NAME} Inventory`,
        subject: subject,
        body: body
      });
      console.log(`📧 Report sent to ${recipient}`);
    }
    
    console.log('✅ Low stock report sent successfully');
    return Response.json({ 
      success: true, 
      message: `Report sent to ${RECIPIENTS.length} recipient(s)`,
      count: lowStockParts.length,
      totalShortfall: totalShortfall
    });
    
  } catch (error) {
    console.error('❌ Error generating low stock report:', error);
    
    // Send error notification to first recipient
    try {
      await base44.integrations.Core.SendEmail({
        to: RECIPIENTS[0],
        from_name: `${COMPANY_NAME} Inventory`,
        subject: '❌ Low Stock Report Failed',
        body: `
          <h2>Error Generating Low Stock Report</h2>
          <p>The daily low stock report failed to generate.</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p>Please check the system logs and contact support if this persists.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send error notification:', emailError);
    }
    
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});