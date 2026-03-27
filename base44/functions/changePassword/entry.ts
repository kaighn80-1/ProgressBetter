import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const { currentPassword, newPassword } = await req.json();
    
    // Get current user
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      return Response.json({ error: 'Password must contain at least one uppercase letter' }, { status: 400 });
    }
    
    if (!/[a-z]/.test(newPassword)) {
      return Response.json({ error: 'Password must contain at least one lowercase letter' }, { status: 400 });
    }
    
    if (!/[0-9]/.test(newPassword)) {
      return Response.json({ error: 'Password must contain at least one number' }, { status: 400 });
    }
    
    // Change password
    await base44.auth.changePassword({
      userId: user.id,
      currentPassword: currentPassword,
      newPassword: newPassword
    });
    
    // Update tracking fields
    await base44.entities.User.update(user.id, {
      last_password_change: new Date().toISOString().split('T')[0],
      must_change_password: false
    });
    
    return Response.json({ 
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error: any) {
    console.error('Password change error:', error);
    
    // Handle specific error messages
    if (error.message?.includes('Invalid password') || error.message?.includes('incorrect')) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
    }
    
    return Response.json({ 
      error: error.message || 'Failed to change password' 
    }, { status: 500 });
  }
});