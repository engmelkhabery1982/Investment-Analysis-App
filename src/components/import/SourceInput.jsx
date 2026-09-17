import { useRef, useState } from 'react';
import { Upload, ClipboardPaste, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseFile, parseClipboard } from '@/lib/importEngine';

export default function SourceInput({ onData, onError }) {
  const [method, setMethod] = useState('file');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setFileName(f.name);
    try {
      const { rows } = await parseFile(f);
      if (!rows.length) { onError('No rows found in file.'); return; }
      onData(rows, f.name);
    } catch (err) {
      onError(`Failed to read file: ${err.message || err}`);
    } finally { setBusy(false); }
  }

  function onPaste() {
    if (!paste.trim()) { onError('Paste some data first.'); return; }
    const { rows } = parseClipboard(paste);
    if (!rows.length) { onError('No rows detected in pasted data.'); return; }
    onData(rows, 'pasted data');
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Button variant={method === 'file' ? 'default' : 'outline'} size="sm" onClick={() => setMethod('file')}><Upload className="w-4 h-4 mr-2" />Upload file</Button>
        <Button variant={method === 'paste' ? 'default' : 'outline'} size="sm" onClick={() => setMethod('paste')}><ClipboardPaste className="w-4 h-4 mr-2" />Paste from spreadsheet</Button>
      </div>

      {method === 'file' ? (
        <div className="border-2 border-dashed rounded-xl p-8 text-center">
          <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Drag a CSV or Excel file, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls,.xlsm" onChange={onFile} className="hidden" />
          <Button className="mt-4" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Reading…' : 'Choose file'}</Button>
          {fileName && <p className="text-xs text-muted-foreground mt-3">Selected: {fileName}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Paste tab- or comma-separated rows (copy a rectangle from Excel / Google Sheets)</Label>
          <Textarea rows={10} value={paste} onChange={e => setPaste(e.target.value)} placeholder="Date	Amount	Currency	Description	InstallmentNumber	PaymentType	Status	Notes&#10;2024-09-01	500000	EGP	Down payment	1	Down Payment	paid	" />
          <Button onClick={onPaste} disabled={!paste.trim()}>Parse pasted data</Button>
        </div>
      )}
    </div>
  );
}