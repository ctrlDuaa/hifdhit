import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/runtimeClient';
import { countries, type CountryOption } from '@/utils/timezoneMapping';
import { Globe } from 'lucide-react';
interface UsernameSetupProps {
  isOpen: boolean;
  onComplete: () => void;
}
export const UsernameSetup = ({
  isOpen,
  onComplete
}: UsernameSetupProps) => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [username, setUsername] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'country' | 'username'>('country');
  const handleCountrySubmit = () => {
    if (!selectedCountry) {
      toast({
        title: "Validation Error",
        description: "Please select your country.",
        variant: "destructive"
      });
      return;
    }
    setStep('username');
  };
  const handleSubmit = async () => {
    if (!username.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a username.",
        variant: "destructive"
      });
      return;
    }

    // Basic username validation
    if (username.length < 3 || username.length > 20) {
      toast({
        title: "Invalid Username",
        description: "Username must be between 3 and 20 characters.",
        variant: "destructive"
      });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast({
        title: "Invalid Username",
        description: "Username can only contain letters, numbers, and underscores.",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const {
        error
      } = await supabase.from('profiles').update({
        username: username.trim(),
        country: selectedCountry?.name,
        timezone: selectedCountry?.timezone
      }).eq('user_id', user?.id);
      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          toast({
            title: "Username Taken",
            description: "This username is already taken. Please choose another.",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }
      toast({
        title: "Setup Complete!",
        description: "Your profile has been successfully set up."
      });
      onComplete();
    } catch (error) {
      console.error('Error setting username:', error);
      toast({
        title: "Error",
        description: "Failed to set username. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'country' ? 'Welcome to Hifdh it!' : 'Choose Your Username'}
          </DialogTitle>
          <DialogDescription>
            {step === 'country' ? 'Select your country to set your timezone for accurate activity tracking.' : 'Create a username to participate in live revision sessions.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'country' ? <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Country/Region
              </Label>
              <Select value={selectedCountry?.name} onValueChange={value => {
            const country = countries.find(c => c.name === value);
            setSelectedCountry(country || null);
          }}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {countries.map(country => <SelectItem key={country.name} value={country.name}>
                      {country.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
              {selectedCountry && <p className="text-xs text-muted-foreground">
                  Timezone: {selectedCountry.timezone}
                </p>}
            </div>

            <Button onClick={handleCountrySubmit} disabled={!selectedCountry} className="w-full bg-[#c6a477]">
              Continue
            </Button>
          </div> : <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} maxLength={20} onKeyDown={e => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }} />
              <p className="text-xs text-black">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="w-full" onClick={() => setStep('country')} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !username.trim()} className="w-full bg-[#c6a477]">
                {isSubmitting ? 'Setting Up...' : 'Complete Setup'}
              </Button>
            </div>
          </div>}
      </DialogContent>
    </Dialog>;
};