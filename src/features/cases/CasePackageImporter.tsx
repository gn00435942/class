import { ChangeEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileArchive, Upload, X } from 'lucide-react';
import { commitCasePackage, previewCasePackage } from './importer';
import type { CasePackagePreview } from './importer';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (caseId: string) => Promise<void>;
}

export default function CasePackageImporter({ open, onClose, onImported }: Props) {
  const [preview, setPreview] = useState<CasePackagePreview | null>(null);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setPreview(null);
    setForce(false);
    try {
      setPreview(await previewCasePackage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '無法讀取案件包');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const caseId = await commitCasePackage(preview, force);
      await onImported(caseId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '匯入失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div><h2 className="text-lg font-semibold">匯入案件 ZIP</h2><p className="mt-1 text-xs text-slate-400">先驗證與預覽；按下確認前不會寫入案件</p></div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {!preview && (
          <label className="mt-6 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-12 text-center hover:border-blue-400 hover:bg-blue-50/40">
            <FileArchive className="mb-3 h-10 w-10 text-blue-500" />
            <span className="text-sm font-medium">{busy ? '正在檢查 ZIP…' : '點選要匯入的案件 ZIP'}</span>
            <span className="mt-1 text-xs text-slate-400">上限 50 MB，不需要先解壓縮</span>
            <input type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => void choose(event)} className="hidden" />
          </label>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {preview && (
          <div className="mt-6">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" />ZIP 結構、附件大小與 SHA-256 均驗證通過</div>
            </div>
            <dl className="mt-4 grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
              <div><dt className="text-xs text-slate-400">主旨</dt><dd className="mt-1 font-medium">{preview.manifest.case.subject}</dd></div>
              <div><dt className="text-xs text-slate-400">收文日期／文號</dt><dd className="mt-1">{preview.manifest.case.receiveDate || '未提供'}／{preview.manifest.case.externalKey || '未提供'}</dd></div>
              <div><dt className="text-xs text-slate-400">繳交管道</dt><dd className="mt-1">{preview.manifest.deliveries.length} 項</dd></div>
              <div><dt className="text-xs text-slate-400">繳交文件／附件</dt><dd className="mt-1">{preview.manifest.documents.length} 項／{preview.manifest.artifacts.length} 個檔案</dd></div>
            </dl>
            {preview.manifest.warnings.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">需人工確認</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{preview.manifest.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}
            {preview.duplicates.length > 0 && (
              <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900">
                <div className="flex gap-2 font-medium"><AlertTriangle className="h-5 w-5 shrink-0" />發現疑似重複案件，預設阻擋匯入</div>
                <ul className="mt-2 list-disc pl-7">{preview.duplicates.map((duplicate) => <li key={duplicate.id}>{duplicate.subject}（{duplicate.reason}）</li>)}</ul>
                <label className="mt-3 flex items-start gap-2 rounded bg-white/70 p-3">
                  <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-0.5" />
                  <span>我已確認這是不同案件，仍要建立新案件。為避免文號唯一性衝突，新案件不帶入相同文號。</span>
                </label>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <label className="cursor-pointer rounded-md border px-4 py-2 text-sm">改選 ZIP<input type="file" accept=".zip,application/zip" onChange={(event) => void choose(event)} className="hidden" /></label>
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">取消</button>
                <button onClick={() => void commit()} disabled={busy || (preview.duplicates.length > 0 && !force)}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <Upload className="h-4 w-4" />{busy ? '匯入中…' : '確認並一次匯入'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
