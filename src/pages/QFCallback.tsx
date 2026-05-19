import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleQfCallback } from '@/services/qfAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

const QFCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      try {
        const result = await handleQfCallback(searchParams);
        if (cancelled) return;
        console.log("QF SESSION:", JSON.stringify(result, null, 2));
        navigate('/dashboard');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    process();
    return () => { cancelled = true; };
  }, [searchParams, navigate]);

  return (
    <>
      <AppHeader />
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {status === 'processing' && 'Connecting to Quran.com...'}
              {status === 'error' && 'Connection Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'processing' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#C6A477]" />
                <p className="text-sm text-muted-foreground">Completing authentication...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-4 py-4">
                <XCircle className="h-10 w-10 text-destructive" />
                <div className="text-center space-y-1">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    onClick={() => navigate('/dashboard')}
                    variant="outline"
                    className="flex-1"
                  >
                    Back to Dashboard
                  </Button>
                  <Button
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-[#C6A477] hover:bg-[#b8956a] text-white"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default QFCallback;
