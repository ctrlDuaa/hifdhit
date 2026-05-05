import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquarePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/runtimeClient';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const featureRequestSchema = z.object({
  request_text: z.string()
    .trim()
    .min(10, "Please provide at least 10 characters")
    .max(1000, "Request must be less than 1000 characters")
});
export const AppFooter = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [featureRequest, setFeatureRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const handleSubmit = async () => {
    try {
      // Validate input
      const validation = featureRequestSchema.safeParse({ request_text: featureRequest });
      
      if (!validation.success) {
        toast({
          title: validation.error.errors[0].message,
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);

      // Get user profile data if user is logged in
      let userName = null;
      let userEmail = null;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('user_id', user.id)
          .single();

        userName = profile?.username || profile?.full_name || null;
        userEmail = user.email || null;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('send-feature-request-email', {
        body: {
          request_text: featureRequest.trim(),
          user_id: user?.id || null,
          user_email: userEmail,
          user_name: userName,
        }
      });

      if (error) {
        console.error('Error submitting feature request:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to submit feature request');
      }

      toast({
        title: "Thank you for your feedback!",
        description: "We'll review your feature request."
      });

      setFeatureRequest('');
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Feature request submission error:', error);
      toast({
        title: "Unable to submit request",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <>
      <footer className="py-12 px-4 bg-[#2a363b] text-white mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-4" style={{
          color: '#C6A477'
        }}>
            Hifdh it
          </h3>
          <p className="text-white/80 mb-4">Memorize better. Remember longer.</p>
          
          <Button onClick={() => setIsDialogOpen(true)} variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 mb-4">
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Request a Feature
          </Button>
          
          <p className="text-white/60 text-sm">© 2026 Hifdh It. All rights reserved.</p>
        </div>
      </footer>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Feature</DialogTitle>
            <DialogDescription>
              Tell us what feature you'd like to see in Hifdh it. We review all suggestions.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea placeholder="Describe the feature you'd like..." value={featureRequest} onChange={e => setFeatureRequest(e.target.value)} className="min-h-[120px]" />
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-[#c6a477]">
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
};