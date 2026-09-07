import { ChangeEvent, FormEvent, useState } from 'react';
import { Download, FilePlus2, Plus, Trash2, Upload } from 'lucide-react';
import {
  createDelivery,
  createDocument,
  deleteDelivery,
  deleteDocument,
  getDocumentDownloadUrl,
  updateDelivery,
  updateDocument,
  uploadDocumentVersion,
} from './repository';
import type { CaseAggregate, CaseDocumentWithRelations } from './models';
import type { DeliveryStatus, DocumentFormat, DocumentRole, DocumentStatus } from './types';

const deliveryStatus: Record<DeliveryStatus, string> = { open: '待處理', doing: '處理中', done: '已完成' };
const documentStatus: Record<DocumentStatus, string> = {
  not_started: '尚未開始',
  in_progress: '製作中',
  pending_approval: '待核章',
  completed: '已完成',
  submitted: '已送出',
  not_required: '不需要',
};
const roleLabel: Record<DocumentRole, string> = { template: '範本', draft: '草稿', final: '正式檔' };

interface Props {
  item: CaseAggregate;
  reload: () => Promise<void>;
  report: (message: string) => void;
}

export default function CaseOperations({ item, reload, report }: Props) {
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [channel, setChannel] = useState('');
  const [deadline, setDeadline] = useState('');
  const [detail, setDetail] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [format, setFormat] = useState<DocumentFormat>('docx');
  const [uploading, setUploading] = useState<string | null>(null);

  const act = async (work: () => Promise<unknown>) => {
    report('');
    try {
      await work();
      await reload();
    } catch (error) {
      report(error instanceof Error ? error.message : '操作失敗');
    }
  };

  const addDelivery = async (event: FormEvent) => {
    event.preventDefault();
    await act(() => createDelivery({
      caseId: item.id,
      channel,
      deadline: deadline || null,
      detail,
      sortOrder: item.deliveries.length,
    }));
    setChannel('');
    setDeadline('');
    setDetail('');
    setDeliveryOpen(false);
  };

  const addDocument = async (event: FormEvent) => {
    event.preventDefault();
    await act(() => createDocument({
      caseId: item.id,
      name: documentName,
      format,
      sourceType: 'user_upload',
      category: 'deliverable',
      required: true,
      deliveryIds: item.deliveries.map((delivery) => delivery.id),
      sortOrder: item.documents.length,
    }));
    setDocumentName('');
    setDocumentOpen(false);
  };

  const upload = async (document: CaseDocumentWithRelations, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const role = (window.prompt('這個檔案的用途？請輸入 template、draft 或 final', 'template') || 'template') as DocumentRole;
    if (!['template', 'draft', 'final'].includes(role)) {
      report('檔案用途必須是 template、draft 或 final');
      return;
    }
    setUploading(document.id);
    await act(() => uploadDocumentVersion({
      caseId: item.id,
      documentId: document.id,
      file,
      role,
      sourceType: 'user_upload',
      versionLabel: window.prompt('版本名稱', file.name) || file.name,
      makeCurrent: true,
    }));
    setUploading(null);
  };

  const download = async (path: string) => {
    report('');
    try {
      const url = await getDocumentDownloadUrl(path, 120);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      report(error instanceof Error ? error.message : '下載失敗');
    }
  };

  return (
    <div className="border-t border-slate-100 pt-5">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div><h3 className="text-sm font-semibold">繳交管道與日期</h3><p className="text-xs text-slate-400">同一案件可有多個繳交方式與期限</p></div>
          <button onClick={() => setDeliveryOpen(!deliveryOpen)} className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-slate-600"><Plus className="h-3.5 w-3.5" />新增管道</button>
        </div>
        {deliveryOpen && (
          <form onSubmit={addDelivery} className="mb-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_150px_1fr_auto]">
            <input required placeholder="例如：公務填報系統" value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded border px-2 py-1.5 text-sm" />
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded border px-2 py-1.5 text-sm" />
            <input placeholder="帳號、網址或補充說明" value={detail} onChange={(e) => setDetail(e.target.value)} className="rounded border px-2 py-1.5 text-sm" />
            <button className="rounded bg-blue-600 px-3 text-xs font-medium text-white">加入</button>
          </form>
        )}
        <div className="space-y-2">
          {item.deliveries.map((delivery) => (
            <div key={delivery.id} className="grid items-center gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_140px_110px_auto]">
              <div><p className="text-sm font-medium">{delivery.channel}</p><p className="text-xs text-slate-400">{delivery.detail || '無補充說明'}</p></div>
              <input type="date" value={delivery.deadline ?? ''} onChange={(e) => void act(() => updateDelivery(delivery.id, { deadline: e.target.value || null }))} className="rounded border px-2 py-1.5 text-xs" />
              <select value={delivery.status} onChange={(e) => void act(() => updateDelivery(delivery.id, { status: e.target.value as DeliveryStatus }))} className="rounded border px-2 py-1.5 text-xs">
                {Object.entries(deliveryStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button onClick={() => window.confirm('刪除此繳交管道？') && void act(() => deleteDelivery(delivery.id))} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {!item.deliveries.length && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-400">尚未設定繳交管道</p>}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <div><h3 className="text-sm font-semibold">繳交文件與成品</h3><p className="text-xs text-slate-400">可保存正式範本、草稿及最後繳交檔</p></div>
          <button onClick={() => setDocumentOpen(!documentOpen)} className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-slate-600"><FilePlus2 className="h-3.5 w-3.5" />新增文件</button>
        </div>
        {documentOpen && (
          <form onSubmit={addDocument} className="mb-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_130px_auto]">
            <input required placeholder="例如：參賽名冊" value={documentName} onChange={(e) => setDocumentName(e.target.value)} className="rounded border px-2 py-1.5 text-sm" />
            <select value={format} onChange={(e) => setFormat(e.target.value as DocumentFormat)} className="rounded border px-2 py-1.5 text-sm">
              <option value="docx">Word</option><option value="xlsx">Excel</option><option value="pdf">PDF</option><option value="online_form">線上表單</option><option value="paper">紙本</option><option value="other">其他</option>
            </select>
            <button className="rounded bg-blue-600 px-3 text-xs font-medium text-white">加入</button>
          </form>
        )}
        <div className="space-y-3">
          {item.documents.map((document) => (
            <article key={document.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h4 className="text-sm font-medium">{document.name}</h4><p className="text-xs text-slate-400">{document.format.toUpperCase()} · {document.versions.length} 個版本</p></div>
                <div className="flex items-center gap-2">
                  <select value={document.status} onChange={(e) => void act(() => updateDocument(document.id, { status: e.target.value as DocumentStatus }))} className="rounded border px-2 py-1.5 text-xs">
                    {Object.entries(documentStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <label className="flex cursor-pointer items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white">
                    <Upload className="h-3.5 w-3.5" />{uploading === document.id ? '上傳中…' : '上傳版本'}
                    <input type="file" className="hidden" accept=".doc,.docx,.odt,.xls,.xlsx,.ods,.pdf,.csv,.txt,.jpg,.jpeg,.png" disabled={uploading === document.id} onChange={(e) => void upload(document, e)} />
                  </label>
                  <button onClick={() => window.confirm('刪除此繳交文件及全部版本？') && void act(() => deleteDocument(document.id))} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {document.versions.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-md bg-slate-50">
                  {[...document.versions].reverse().map((version) => (
                    <div key={version.id} className="flex items-center justify-between border-b border-white px-3 py-2 last:border-0">
                      <div className="min-w-0"><p className="truncate text-xs font-medium">{version.fileName}</p>
                        <p className="text-[11px] text-slate-400">v{version.versionNumber} · {roleLabel[version.role]} · {version.versionLabel}{version.isCurrent ? ' · 目前版本' : ''}</p></div>
                      <button onClick={() => void download(version.storagePath)} className="ml-3 flex shrink-0 items-center gap-1 rounded border bg-white px-2 py-1 text-[11px] text-slate-600"><Download className="h-3 w-3" />下載</button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
          {!item.documents.length && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-400">尚未建立繳交文件</p>}
        </div>
      </section>
    </div>
  );
}
