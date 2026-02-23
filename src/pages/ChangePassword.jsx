import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Lock, Loader2, AlertTriangle } from 'lucide-react';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Check if PIN verified in this session (within last hour)
      if (currentUser.pin_verified_at) {
        const verifiedAt = new Date(currentUser.pin_verified_at);
        const hoursSinceVerification = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceVerification > 1) {
          toast.info('Please verify your PIN first');
          navigate('/PinVerification');
          return;
        }
      } else {
        toast.info('Please verify your PIN first');
        navigate('/PinVerification');
        return;
      }
      
      setInitializing(false);
    } catch (error) {
      toast.error('Please log in first');
      base44.auth.redirectToLogin();
    }
  };

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      // Call backend function to change password
      const response = await base44.functions.changePassword({ 
        currentPassword, 
        newPassword 
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success('Password changed successfully!');
      
      // Small delay to ensure database is updated
      setTimeout(() => {
        navigate('/Dashboard');
      }, 500);
      
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (user.must_change_password) {
      toast.error('You must change your password to continue');
      return;
    }

    // Calculate days since last password change
    if (user.last_password_change) {
      const lastChange = new Date(user.last_password_change);
      const daysSinceChange = Math.floor((Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceChange > 30) {
        toast.warning('Password change recommended but not enforced yet');
      }
    }

    navigate('/Dashboard');
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const daysSinceChange = user.last_password_change 
    ? Math.floor((Date.now() - new Date(user.last_password_change).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Change Password</CardTitle>
          <CardDescription>
            {user.must_change_password 
              ? 'You must change your password to continue'
              : daysSinceChange > 30
              ? `Your password is ${daysSinceChange} days old - please update it`
              : 'Update your password for security'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.must_change_password && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-orange-800">
                <strong>Security Notice:</strong> You are using a temporary password. 
                Please create a strong password to secure your account.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="h-12 text-base"
                required
              />
              <p className="text-xs text-slate-500">
                At least 8 characters with uppercase, lowercase, and numbers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="h-12 text-base"
                required
              />
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={loading}
                style={{ backgroundColor: '#3B82F6', color: 'white' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>

              {!user.must_change_password && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSkip}
                  disabled={loading}
                >
                  {daysSinceChange > 30 ? 'Remind Me Later' : 'Cancel'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}