import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quranApi } from "@/services/quranApi";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const QuranTest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [testName, setTestName] = useState<string>("");

  const runTest = async (name: string, fn: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTestName(name);
    try {
      const data = await fn();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Quran Foundation API Test</CardTitle>
          <p className="text-muted-foreground text-sm">
            Tests connectivity to the Quran Foundation Content API through our secure edge function.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => runTest("Test Verse (1:1)", () => quranApi.testVerse())} disabled={loading} size="sm">
              Test 1:1
            </Button>
            <Button onClick={() => runTest("Chapters List", () => quranApi.getChapters())} disabled={loading} size="sm" variant="outline">
              All Chapters
            </Button>
            <Button onClick={() => runTest("Al-Fatiha Verses", () => quranApi.getVersesByChapter(1))} disabled={loading} size="sm" variant="outline">
              Al-Fatiha
            </Button>
            <Button onClick={() => runTest("Verse Range 2:1-5", () => quranApi.getVerseRange(2, 1, 5))} disabled={loading} size="sm" variant="outline">
              Al-Baqarah 1-5
            </Button>
            <Button onClick={() => runTest("Chapter Audio", () => quranApi.getChapterAudio(1))} disabled={loading} size="sm" variant="outline">
              Chapter Audio
            </Button>
            <Button onClick={() => runTest("Verse Audio", () => quranApi.getVerseAudio(1))} disabled={loading} size="sm" variant="outline">
              Verse Audio
            </Button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Testing: {testName}...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Failed: {testName}</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">✓ {testName}</span>
              </div>
              <pre className="p-4 rounded-lg bg-muted text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuranTest;
