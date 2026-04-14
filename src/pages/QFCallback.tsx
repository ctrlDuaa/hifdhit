import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleQfCallback, QfOAuthSession, callQfUserApi } from '@/services/qfAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

interface DebugResult {
  path: string;
  status: string;
  parsed: unknown;
  error?: string;
}

const QFCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [session, setSession] = useState<QfOAuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugResults, setDebugResults] = useState<DebugResult[]>([]);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      try {
        const result = await handleQfCallback(searchParams);
        if (cancelled) return;
        console.log("QF SESSION:", JSON.stringify(result, null, 2));
        setSession(result);
        setStatus('success');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    process();
    return () => { cancelled = true; };
  }, [searchParams]);

  const runCollectionsDebug = async () => {
    setDebugLoading(true);
    setDebugResults([]);
    const testPath = '/auth/v1/collections?first=1&type=ayah';

    try {
      console.log('[DEBUG] Testing collections path:', testPath);
      const raw = await callQfUserApi(testPath) as any;
      console.log('[DEBUG] Raw callQfUserApi result:', JSON.stringify(raw, null, 2));

      setDebugResults([{
        path: testPath,
        status: raw?.upstreamStatus?.toString() ?? 'no upstreamStatus field',
        parsed: raw,
      }]);
    } catch (err) {
      console.error('[DEBUG] callQfUserApi threw:', err);
      setDebugResults([{
        path: testPath,
        status: 'THREW',
        parsed: null,
        error: err instanceof Error ? err.message : String(err),
      }]);
    }
    setDebugLoading(false);
  };

  return (
    <>
      <AppHeader />
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {status === 'processing' && 'Connecting to Quran.com...'}
              {status === 'success' && 'Connected!'}
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

            {status === 'success' && session && (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <div className="text-center space-y-1">
                  {session.user?.name && (
                    <p className="font-medium text-foreground">Welcome, {session.user.name as string}!</p>
                  )}
                  {session.user?.email && (
                    <p className="text-sm text-muted-foreground">{session.user.email as string}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Your Quran.com bookmarks, collections, and reading progress are now synced.
                  </p>
                  {session.accessToken && (
                    <div className="mt-3 w-full">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Access Token:</p>
                      <textarea
                        readOnly
                        value={session.accessToken}
                        rows={3}
                        className="w-full text-[10px] font-mono bg-muted p-2 rounded border border-border break-all resize-none"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                    </div>
                  )}
                </div>

                {/* Debug: Test collections endpoint */}
                <div className="w-full border-t border-border/50 pt-3 mt-2">
                  <Button
                    onClick={runCollectionsDebug}
                    disabled={debugLoading}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                  >
                    {debugLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    🔍 Debug: Test Collections Endpoint
                  </Button>
                  {debugResults.map((r, i) => (
                    <div key={i} className="mt-2 text-left">
                      <p className="text-[10px] font-mono text-muted-foreground">Path: {r.path}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Upstream Status: {r.status}</p>
                      {r.error && <p className="text-[10px] font-mono text-destructive">Error: {r.error}</p>}
                      <pre className="mt-1 text-[9px] font-mono bg-muted p-2 rounded max-h-60 overflow-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(r.parsed, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-[#C6A477] hover:bg-[#b8956a] text-white"
                >
                  Go to Dashboard
                </Button>
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
