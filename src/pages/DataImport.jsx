import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/lib/hooks';
import { applyImportPlan, bulkUpsertCustomBenchmarks } from '@/lib/store';
import { getImportHistory, addImportHistoryEntry, clearImportHistory } from '@/lib/importHistory';
import { DEMO_TAG } from '@/lib/sampleData';
import {
  IMPORT_TYPES, TYPE_ORDER, extractHeaders, autoMapColumns,
  prepareRows, plannedAction, buildOps, summarize, STATUS,
} from '@/lib/importEngine';
import { downloadCSV } from '@/lib/csv';
import StepBar from '@/components/import/StepBar';
import TypeCards from '@/components/import/TypeCards';
import SourceInput from '@/components/import/SourceInput';
import RawPreview from '@/components/import/RawPreview';
import ColumnMapping from '@/components/import/ColumnMapping';
import PreviewTable from '@/components/import/PreviewTable';
import ImportResult from '@/components/import/ImportResult';
import HistoryPanel from '@/components/import/HistoryPanel';

export default function DataImport() {
  const s = useStore();
  const [params] = useSearchParams();
  const initialType = TYPE_ORDER.includes(params.get('type')) ? params.get('type') : null;
  const presetInvestmentId = params.get('investmentId');

  const [step, setStep] = useState(initialType ? 2 : 1);
  const [type, setType] = useState(initialType || null);
  const [source, setSource] = useState(null); // { headers, dataRows, fileName }
  const [map, setMap] = useState({});
  const [dateFormat, setDateFormat] = useState('auto');
  const [numberFormat, setNumberFormat] = useState('auto');
  const [investmentId, setInvestmentId] = useState(presetInvestmentId || s.settings.selectedInvestmentId || '');
  const [conflictAction, setConflictAction] = useState('skip');
  const [overrides, setOverrides] = useState({});
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => getImportHistory());

  const existingCounts = {
    cashflow: s.cashflows.length, gold: s.gold.length, fx: s.fx.length, cpi: s.cpi.length,
    investment: s.investments.length,
    custombenchmark: (s.customBenchmarks || []).reduce((n, b) => n + (b.data || []).length, 0),
  };

  // Demo data presence detection (never auto-delete; just warn).
  const demoPresent = useMemo(() => {
    return s.gold.some(g => g.quality === 'Demo' || g.source === DEMO_TAG) ||
      s.fx.some(f => f.quality === 'Demo' || f.source === DEMO_TAG) ||
      s.cpi.some(c => c.source === DEMO_TAG) ||
      s.cashflows.some(c => (c.notes || '').includes(DEMO_TAG));
  }, [s]);

  const selectedInvestment = useMemo(() => s.investments.find(i => i.id === investmentId) || null, [s.investments, investmentId]);

  // ---- Prepare rows (validation + duplicate/conflict) ----
  const prepared = useMemo(() => {
    if (!source || !type) return [];
    const opts = { dateFormat, numberFormat, settings: s.settings };
    const ctx = type === 'cashflow'
      ? { investmentId, valuationDate: selectedInvestment?.valuationDate }
      : {};
    let existing;
    if (type === 'cashflow') existing = s.cashflows.filter(c => c.investmentId === investmentId);
    else if (type === 'custombenchmark') existing = (s.customBenchmarks || []).flatMap(cb => (cb.data || []).map(r => ({ name: cb.name, date: r.date })));
    else existing = s[IMPORT_TYPES[type].collectionKey];
    return prepareRows(type, source.dataRows, map, opts, existing, ctx);
  }, [source, type, map, dateFormat, numberFormat, s, investmentId, selectedInvestment]);

  const ambiguousCount = useMemo(() => prepared.filter(p => p.built._dateInfo?.ambiguous).length, [prepared]);

  const actions = useMemo(() => prepared.map(p => plannedAction(p, conflictAction, overrides)), [prepared, conflictAction, overrides]);
  const summary = useMemo(() => summarize(prepared, actions), [prepared, actions]);

  function selectType(t) { setType(t); setStep(2); resetFlow(); }
  function resetFlow() { setSource(null); setMap({}); setOverrides({}); setResult(null); setError(''); setFilter('all'); setConflictAction('skip'); }

  function onData(rows, fileName) {
    const { hasHeader, headers, dataRows } = extractHeaders(rows);
    if (!hasHeader) {
      // If no header detected, treat first row as headers anyway (generic Column N) and keep all rows as data.
      const headers2 = rows[0].map((_, i) => `Column ${i + 1}`);
      setSource({ headers: headers2, dataRows: rows, fileName });
      setMap(autoMapColumns(headers2, type));
    } else {
      setSource({ headers, dataRows, fileName });
      setMap(autoMapColumns(headers, type));
    }
    setStep(3);
  }

  function setAction(rowIndex, action) { setOverrides(o => ({ ...o, [rowIndex]: action })); }

  function canConfirm() {
    if (type === 'cashflow' && !investmentId) return false;
    if (ambiguousCount > 0 && dateFormat === 'auto') return false;
    if (summary.toInsert + summary.toReplace === 0) return false;
    return true;
  }

  function doImport() {
    const ops = buildOps(type, prepared, actions);
    if (!ops.length) { setError('Nothing to import.'); return; }
    let inserted, replaced, skipped, touchedBenchmarks = 0;
    if (type === 'custombenchmark') {
      const groups = {};
      for (const op of ops) {
        const r = op.record;
        if (!groups[r.name]) groups[r.name] = { name: r.name, currency: r.currency, data: [] };
        groups[r.name].data.push({ date: r.date, value: r.value, source: r.source });
      }
      touchedBenchmarks = bulkUpsertCustomBenchmarks(Object.values(groups));
      inserted = ops.length; replaced = 0;
    } else {
      const res = applyImportPlan(type, ops);
      inserted = res.inserted; replaced = res.replaced;
    }
    const rejectedRows = prepared.filter(p => p.errors.length).map(p => ({ row: p.rowIndex + 2, reason: p.errors.join('; ') }));
    const rejected = rejectedRows.length;
    skipped = prepared.length - inserted - replaced - rejected;
    const dupSkipped = prepared.filter((p, i) => (actions[i] === 'skip' && p.status === STATUS.DUPLICATE)).length;
    const resultObj = {
      inserted, replaced, skipped, duplicatesSkipped: dupSkipped, rejected,
      warnings: summary.warnings, errors: summary.errors, rejectedRows, touchedBenchmarks,
    };
    setResult(resultObj);
    addImportHistoryEntry({ type, fileName: source.fileName, rowsReceived: prepared.length, inserted, replaced, skipped, rejected });
    setHistory(getImportHistory());
    setStep(6);
  }

  function downloadErrors() {
    if (!result?.rejectedRows?.length) return;
    downloadCSV('import_rejections.csv', [['Row', 'Reason'], ...result.rejectedRows.map(r => [r.row, r.reason])]);
  }

  function restart() { resetFlow(); setStep(type ? 2 : 1); }

  function clearHistory() { clearImportHistory(); setHistory([]); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading tracking-tight">Data Import Center</h1>
          <p className="text-sm text-muted-foreground">Safely import real financial data with validation, duplicate detection, and a full audit preview.</p>
        </div>
      </div>

      {demoPresent && (
        <div className="flex items-start gap-2 text-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>Demo data is present in your local store. Imported real data will be added alongside it — demo records are never modified or deleted automatically. Use Settings → “Remove demo data” to clear them first if you want a clean dataset.</div>
        </div>
      )}

      <StepBar current={step} />

      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>}

      {step === 1 && (
        <div className="space-y-4">
          <TypeCards selected={type} counts={existingCounts} lastResults={groupByType(history)} onSelect={selectType} />
          <Card>
            <CardHeader><CardTitle className="text-base">Import history</CardTitle></CardHeader>
            <CardContent><HistoryPanel history={history} onClear={clearHistory} /></CardContent>
          </Card>
        </div>
      )}

      {step >= 2 && type && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Importing:</span>
          <span className="font-medium">{IMPORT_TYPES[type].label}</span>
          <Button size="sm" variant="ghost" onClick={() => { setStep(1); }}>Change</Button>
        </div>
      )}

      {step === 2 && (
        <Card><CardContent className="pt-6">
          <SourceInput onData={onData} onError={setError} />
        </CardContent></Card>
      )}

      {step === 3 && source && (
        <Card><CardContent className="pt-6 space-y-4">
          <div className="text-sm text-muted-foreground">Source: <span className="font-medium text-foreground">{source.fileName}</span></div>
          <RawPreview headers={source.headers} dataRows={source.dataRows} />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
            <Button onClick={() => setStep(4)}>Continue to mapping <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </div>
        </CardContent></Card>
      )}

      {step === 4 && source && (
        <Card><CardContent className="pt-6 space-y-4">
          <ColumnMapping
            type={type} headers={source.headers} map={map} setMap={setMap}
            dateFormat={dateFormat} setDateFormat={setDateFormat}
            numberFormat={numberFormat} setNumberFormat={setNumberFormat}
            ambiguousCount={ambiguousCount}
            investments={s.investments} investmentId={investmentId} setInvestmentId={setInvestmentId}
            settings={s.settings}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
            <Button onClick={() => setStep(5)} disabled={type === 'cashflow' && !investmentId}>
              {type === 'cashflow' && !investmentId ? 'Select an investment first' : <>Validate & preview <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
        </CardContent></Card>
      )}

      {step === 5 && source && (
        <div className="space-y-4">
          <SummaryBar summary={summary} />
          <PreviewTable
            type={type} prepared={prepared} actions={actions} setAction={setAction}
            conflictAction={conflictAction} setConflictAction={setConflictAction}
            filter={filter} setFilter={setFilter}
          />
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep(4)}><ArrowLeft className="w-4 h-4 mr-2" />Back to mapping</Button>
            <Button onClick={doImport} disabled={!canConfirm()} size="lg">
              <Check className="w-4 h-4 mr-2" />Confirm import ({summary.toInsert + summary.toReplace} records)
            </Button>
          </div>
          {!canConfirm() && <p className="text-xs text-muted-foreground text-right">{type === 'cashflow' && !investmentId ? 'Select an investment to assign cash flows. ' : ''}{ambiguousCount > 0 && dateFormat === 'auto' ? 'Resolve ambiguous dates (pick a date format) before confirming. ' : ''}Nothing will be imported until you confirm.</p>}
        </div>
      )}

      {step === 6 && result && (
        <ImportResult result={result} onDownloadErrors={downloadErrors} onRestart={restart} />
      )}

      {step === 6 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import history</CardTitle></CardHeader>
          <CardContent><HistoryPanel history={history} onClear={clearHistory} /></CardContent>
        </Card>
      )}
    </div>
  );
}

function groupByType(history) {
  const map = {};
  for (const h of history) { if (!map[h.type]) map[h.type] = h; }
  return map;
}

function SummaryBar({ summary }) {
  const items = [
    { label: 'Total rows', value: summary.total },
    { label: 'Ready', value: summary.ready, tone: 'text-green-600' },
    { label: 'New', value: summary.new, tone: 'text-blue-600' },
    { label: 'Duplicates', value: summary.duplicates, tone: 'text-amber-600' },
    { label: 'Conflicts', value: summary.conflicts, tone: 'text-orange-600' },
    { label: 'To replace', value: summary.toReplace, tone: 'text-blue-600' },
    { label: 'To skip', value: summary.toSkip, tone: 'text-muted-foreground' },
    { label: 'Warnings', value: summary.warnings, tone: 'text-amber-600' },
    { label: 'Errors', value: summary.errors, tone: 'text-destructive' },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border rounded-lg p-4 bg-muted/30 text-sm">
      {items.map(it => (
        <div key={it.label}>
          <span className={`font-semibold ${it.tone || ''}`}>{it.value}</span>
          <span className="text-muted-foreground ml-1">{it.label}</span>
        </div>
      ))}
    </div>
  );
}