import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';

export default function SetupPin() {
  const navigate = useNavigate();
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [step, setStep] = useState(1); // 1 = enter PIN, 2 = confirm PIN
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
      
      // If PIN already set, redirect to verification
      if (currentUser.pin_code) {
        navigate('/PinVerification');
        return;
      }
      
      setInitializing(false);
    } catch (error) {
      toast.error('Please log in first');
      base44.auth.redirectToLogin();
    }
  };

  const handlePinChange = (index, value, isConfirm = false) => {
    if (value && !/^\d$/.test(value)) return;
    
    const currentPin = isConfirm ? confirmPin : pin;
    const setCurrentPin = isConfirm ? setConfirmPin : setPin;
    
    const newPin = [...currentPin];
    newPin[index] = value;
    setCurrentPin(newPin);

    if (value && index < 3) {
      const prefix = isConfirm ? 'confirm-pin' : 'pin';
      document.getElementById(`${prefix}-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e, isConfirm = false) => {
    const currentPin = isConfirm ? confirmPin : pin;
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      const prefix = isConfirm ? 'confirm-pin' : 'pin';
      document.getElementById(`${prefix}-${index - 1}`)?.focus();
    }
  };

  const handleContinue = () => {
    const enteredPin = pin.join('');
    if (enteredPin.length !== 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }
    setStep(2);
    setTimeout(() => document.getElementById('confirm-pin-0')?.focus(), 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const enteredPin = pin.join('');
    const enteredConfirmPin = confirmPin.join('');
    
    if (enteredConfirmPin.length !== 4) {
      toast.error('Please confirm your PIN');
      return;
    }

    if (enteredPin !== enteredConfirmPin) {
      toast.error('PINs do not match');
      setConfirmPin(['', '', '', '']);
      setStep(1);
      setPin(['', '', '', '']);
      document.getElementById('pin-0')?.focus();
      return;
    }

    setLoading(true);
    try {
      await base44.auth.updateMe({
        pin_code: enteredPin,
        pin_verified_at: new Date().toISOString()
      });

      toast.success('PIN created successfully');

      // Check if password change required
      if (user.must_change_password) {
        navigate('/ChangePassword');
      } else {
        navigate('/Dashboard');
      }
    } catch (error) {
      toast.error('Failed to create PIN');
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <KeyRound className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Create Your PIN</CardTitle>
          <CardDescription>
            {step === 1 ? 'Choose a 4-digit PIN for additional security' : 'Re-enter your PIN to confirm'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleContinue(); } : handleSubmit} className="space-y-6">
            <div>
              <Label className="sr-only">{step === 1 ? 'Create PIN' : 'Confirm PIN'}</Label>
              <div className="flex gap-3 justify-center">
                {(step === 1 ? pin : confirmPin).map((digit, index) => (
                  <Input
                    key={index}
                    id={`${step === 1 ? 'pin' : 'confirm-pin'}-${index}`}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, step === 2)}
                    onKeyDown={(e) => handleKeyDown(index, e, step === 2)}
                    className="w-16 h-16 text-center text-2xl font-bold"
                    autoFocus={index === 0}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {step === 1 && (
              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={pin.some(d => !d)}
              >
                Continue
              </Button>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full h-12 text-lg"
                  disabled={loading || confirmPin.some(d => !d)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating PIN...
                    </>
                  ) : (
                    'Confirm & Continue'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStep(1);
                    setConfirmPin(['', '', '', '']);
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}