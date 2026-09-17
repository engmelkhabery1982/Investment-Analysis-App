import { useState } from 'react';
import { runTests } from '@/lib/tests';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Play } from 'lucide-react';

export default function Tests() {
  const [results, setResults] = useState(null);

  function run() { setResults(runTests()); }

  const passed = results ? results.filter(r => r.passed).length : 0;
  const total = results ? results.length : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Self-test</h1>
          <p className="text-sm text-muted-foreground">Verifies the core financial rules from the specification.</p>
        </div>
        <Button onClick={run}><Play className="w-4 h-4 mr-2" />Run tests</Button>
      </div>
      {results && (
        <Card>
          <CardHeader><CardTitle className="text-base">{passed}/{total} passed</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-md border ${r.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {r.passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  {!r.passed && <div className="text-xs text-destructive mt-0.5">{r.detail}</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}