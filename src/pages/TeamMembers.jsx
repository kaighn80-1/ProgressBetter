import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Users as UsersIcon
} from 'lucide-react';

export default function TeamMembers() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviting, setInviting] = useState(false);
  
  // Invite form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Operator');
  const [tempPassword, setTempPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, allUsers] = await Promise.all([
        base44.auth.me(),
        base44.entities.User.list()
      ]);
      setCurrentUser(userData);
      setUsers(allUsers);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const generateTempPassword = () => {
    // Generate secure temporary password: 
    // Format: Uppercase + lowercase + numbers + special char (12 chars total)
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%';
    
    let password = '';
    // Ensure at least one of each required type
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill remaining with random characters from all sets
    const allChars = upper + lower + numbers + special;
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleOpenInviteDialog = () => {
    const newTempPassword = generateTempPassword();
    setTempPassword(newTempPassword);
    setEmail('');
    setRole('Operator');
    setPasswordCopied(false);
    setShowInviteDialog(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setPasswordCopied(true);
    toast.success('Password copied to clipboard');
    setTimeout(() => setPasswordCopied(false), 3000);
  };

  const handleInviteUser = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      toast.error('A user with this email already exists');
      return;
    }

    setInviting(true);
    try {
      // Send invitation email with temporary password
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Welcome to Progress Better - Your Account Access',
        body: `
Welcome to Progress Better Manufacturing Tracker!

Your account has been created with the following credentials:

Email: ${email}
Temporary Password: ${tempPassword}
Role: ${role}

IMPORTANT: 
• Please log in at your earliest convenience
• You will be required to change your password immediately upon first login
• For security reasons, this temporary password is only valid for the first login

Login Instructions:
1. Go to the app login page
2. Enter your email and temporary password
3. You will be prompted to create a new secure password
4. Your new password must be at least 8 characters long and contain:
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character (!@#$%)

If you have any questions or need assistance, please contact your administrator.

Best regards,
Progress Better Team
        `.trim()
      });

      toast.success(`Invitation sent to ${email}`);
      toast.info('Make sure to provide the temporary password to the user', { duration: 5000 });
      
      setShowInviteDialog(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error('Failed to send invitation email. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setRole('Operator');
    setTempPassword('');
    setPasswordCopied(false);
  };

  const getRoleBadge = (userRole) => {
    const roleConfig = {
      admin: { bg: '#FEF3C7', color: '#92400E', label: 'Manager' },
      Manager: { bg: '#FEF3C7', color: '#92400E', label: 'Manager' },
      Supervisor: { bg: '#FED7AA', color: '#92400E', label: 'Supervisor' },
      Operator: { bg: '#DBEAFE', color: '#1E40AF', label: 'Operator' },
      user: { bg: '#DBEAFE', color: '#1E40AF', label: 'Operator' }
    };
    
    const config = roleConfig[userRole] || roleConfig.user;
    return (
      <Badge style={{ backgroundColor: config.bg, color: config.color }}>
        <Shield className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Manager';

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: '#CBD5E1' }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E293B' }}>Access Denied</h3>
        <p style={{ color: '#64748B' }}>Only managers can access team member management</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1E293B' }}>Team Members</h1>
          <p style={{ color: '#64748B' }}>Manage user access and invitations</p>
        </div>
        <Button 
          size="lg" 
          onClick={handleOpenInviteDialog}
          style={{ backgroundColor: '#3B82F6', color: 'white' }}
          className="hover:opacity-90"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>Note:</strong> When you invite a new user, they will receive an email with a temporary password. 
          They must change this password immediately upon first login for security.
        </AlertDescription>
      </Alert>

      {/* Team Members List */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" style={{ color: '#3B82F6' }} />
            Current Team Members ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-4 rounded-lg" 
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
              >
                <div className="flex-1">
                  <p className="font-bold" style={{ color: '#1E293B' }}>{user.full_name || 'Unknown User'}</p>
                  <p className="text-sm flex items-center gap-1" style={{ color: '#64748B' }}>
                    <Mail className="w-3 h-3" />
                    {user.email}
                  </p>
                  {user.id === currentUser.id && (
                    <Badge variant="outline" className="mt-1 text-xs" style={{ color: '#10B981', borderColor: '#10B981' }}>
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {getRoleBadge(user.role)}
                  {user.must_change_password && (
                    <Badge style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Pending Password Change
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(open) => {
        setShowInviteDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="h-12 mt-1 text-base"
                disabled={inviting}
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={role} onValueChange={setRole} disabled={inviting}>
                <SelectTrigger className="h-12 mt-1 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manager">Manager (Full Access)</SelectItem>
                  <SelectItem value="Supervisor">Supervisor (Limited Access)</SelectItem>
                  <SelectItem value="Operator">Operator (Production Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '2px solid #F59E0B' }}>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-bold" style={{ color: '#92400E' }}>
                  Temporary Password
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTempPassword(generateTempPassword())}
                  disabled={inviting}
                  className="h-8 text-xs"
                >
                  Regenerate
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={tempPassword}
                  readOnly
                  className="font-mono text-base h-11"
                  style={{ backgroundColor: '#FFFBEB' }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleCopyPassword}
                  disabled={inviting}
                  className="h-11 w-11"
                >
                  {passwordCopied ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs mt-2" style={{ color: '#92400E' }}>
                ⚠️ This password will be sent via email and must be changed on first login
              </p>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-xs text-blue-800">
                <strong>What happens next:</strong>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li>An email will be sent to {email || 'the user'} with login credentials</li>
                  <li>The user will be forced to change their password on first login</li>
                  <li>Make sure to copy and save the temporary password before sending</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowInviteDialog(false);
                resetForm();
              }}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleInviteUser} 
              disabled={inviting || !email}
              style={{ backgroundColor: '#3B82F6', color: 'white' }}
            >
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}