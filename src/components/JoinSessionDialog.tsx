import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSessionSystem } from '@/hooks/useSessionSystem';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
export const JoinSessionDialog = () => {
  const [open, setOpen] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const {
    joinSessionByCode,
    loading
  } = useSessionSystem();
  const navigate = useNavigate();
  const handleJoinSession = async () => {
    if (!sessionCode.trim()) {
      return;
    }
    const sessionId = await joinSessionByCode(sessionCode.trim().toUpperCase());
    if (sessionId) {
      navigate(`/session/${sessionId}`);
      setOpen(false);
      setSessionCode('');
    }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full bg-[#fbf6ed] text-slate-800">
          <LogIn className="w-4 h-4 mr-2" />
          Join Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Revision Session</DialogTitle>
          <DialogDescription>
            Enter the session code shared by your partner to join.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionCode">Session Code</Label>
            <Input id="sessionCode" placeholder="e.g., A5F3K" value={sessionCode} onChange={e => setSessionCode(e.target.value.toUpperCase())} onKeyDown={e => {
            if (e.key === 'Enter') {
              handleJoinSession();
            }
          }} maxLength={5} className="text-center text-2xl font-bold tracking-widest uppercase" />
            <p className="text-xs text-muted-foreground text-center">
              You will join as the reciter
            </p>
          </div>

          <Button onClick={handleJoinSession} disabled={loading || !sessionCode.trim()} className="w-full bg-[3#C6A477] bg-[#c6a477]">
            {loading ? 'Joining...' : 'Join Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
};