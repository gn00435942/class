import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, BriefcaseBusiness, LogIn, LogOut, Plus, RefreshCw, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { archiveCase, createCase, listCases, updateCase } from './repository';
import CaseOperations from './CaseOperations';
import type { CaseAggregate } from './models';
import type { CaseStatus } from './types';

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: '待處理',
  doing: '處理中',
  done: '已完成',
  archived: '已封存',
};

interface Draft {
  id?: string;
  receiveDate: string;
  externalKey: string;
  subject: string;
  content: string;
  note: string;
  status: CaseStatus;
}

const EMPTY_DRAFT: Draft = {
  receiveDate: '',
  externalKey: '',
  subject: '',
  content: '',
  note: '',
  status: 'open',
};

function draftFromCase(item: CaseAggregate): Draft {
  return {
    id: item.id,
    receiveDate: item.receiveDate ?? '',
    externalKey: item.externalKey ?? '',
    subject: item.subject,
    content: item.content,
    note: item.note,
    status: item.status,
  };
}

export default function CaseWorkspace() {
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cases, setCases] = useState<CaseAggregate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const selected = useMemo(
    () => cases.find((item) => item.id === selectedId) ?? null,
    [cases, selectedId]
  );

  const load = useCallback(async () => {
    setBusy(true);
    setNotice('');
    try {
      const items = await listCases();
      setCases(items);
      setSelectedId((current) => current && items.some((item) => item.id === current)
        ? current
        : items[0]?.id ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '讀取案件失敗');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (signedIn) void load();
    else setCases([]);
  }, [signedIn, load]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setNotice(error.message);
    setBusy(false);
  };

  const beginNew = () => {
    setDraft(EMPTY_DRAFT);
    setEditing(true);
  };

  const beginEdit = () => {
    if (!selected) return;
    setDraft(draftFromCase(selected));
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.subject.trim()) {
      setNotice('主旨不可空白');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      if (draft.id) {
        await updateCase(draft.id, {
          receiveDate: draft.receiveDate || null,
          externalKey: draft.externalKey || null,
          subject: draft.subject,
          content: draft.content,
          note: draft.note,
          status: draft.status,
        });
      } else {
        const created = await createCase({
          receiveDate: draft.receiveDate || null,
          externalKey: draft.externalKey || null,
          subject: draft.subject,
          content: draft.content,
          note: draft.note,
          status: draft.status,
        });
        setSelectedId(created.id);
      }
      setEditing(false);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '儲存案件失敗');
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!selected || !window.confirm(`確定封存「${selected.subject}」？`)) return;
    setBusy(true);
    try {
      await archiveCase(selected.id);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '封存案件失敗');
    } finally {
      setBusy(false);
    }
  };

  if (!sessionReady) {
    return <div className="grid h-full place-items-center text-sm text-slate-500">確認登入狀態…</div>;
  }

  if (!signedIn) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6">
        <form onSubmit={signIn} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-2 text-white"><LogIn className="h-5 w-5" /></div>
            <div><h2 className="font-semibold">登入案件控管</h2><p className="text-xs text-slate-400">資料與檔案將儲存在你的 Supabase</p></div>
          </div>
          <label className="mb-3 block text-xs font-medium text-slate-600">Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="mb-4 block text-xs font-medium text-slate-600">密碼
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          {notice && <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{notice}</p>}
          <button disabled={busy} className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? '登入中…' : '登入'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-slate-100">
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div><h2 className="font-semibold">案件清單</h2><p className="text-xs text-slate-400">{cases.length} 件未封存案件</p></div>
          <button onClick={beginNew} className="rounded-md bg-blue-600 p-2 text-white" title="新增案件"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {cases.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)}
              className={`mb-1 w-full rounded-lg p-3 text-left transition ${selectedId === item.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
              <div className="line-clamp-2 text-sm font-medium">{item.subject}</div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{item.receiveDate || '未填收文日'}</span><span>{STATUS_LABEL[item.status]}</span>
              </div>
            </button>
          ))}
          {!cases.length && !busy && <div className="p-6 text-center text-sm text-slate-400">尚無案件</div>}
        </div>
        <div className="m-3 grid grid-cols-2 gap-2">
          <button onClick={() => void load()} disabled={busy} className="flex items-center justify-center gap-2 rounded-md border py-2 text-xs text-slate-500">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />重新整理
          </button>
          <button onClick={() => void supabase.auth.signOut()} className="flex items-center justify-center gap-2 rounded-md border py-2 text-xs text-slate-500">
            <LogOut className="h-3.5 w-3.5" />登出
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        {notice && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{notice}</div>}
        {selected ? (
          <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{STATUS_LABEL[selected.status]}</span>
                <h2 className="mt-3 text-xl font-semibold">{selected.subject}</h2>
                <p className="mt-1 text-xs text-slate-400">收文：{selected.receiveDate || '未填'} · 文號：{selected.externalKey || '未填'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={beginEdit} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">編輯案件</button>
                <button onClick={archive} className="rounded-md border border-slate-200 p-2 text-slate-500" title="封存"><Archive className="h-4 w-4" /></button>
              </div>
            </div>
            <section className="py-5"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">內容</h3>
              <p className="whitespace-pre-wrap text-sm leading-6">{selected.content || '尚未填寫'}</p></section>
            <section className="grid gap-4 border-t border-slate-100 py-5 md:grid-cols-2">
              <div><h3 className="text-xs font-semibold text-slate-400">繳交管道</h3><p className="mt-2 text-2xl font-semibold">{selected.deliveries.length}</p></div>
              <div><h3 className="text-xs font-semibold text-slate-400">繳交文件</h3><p className="mt-2 text-2xl font-semibold">{selected.documents.length}</p></div>
            </section>
            {selected.note && <section className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{selected.note}</section>}
            <CaseOperations item={selected} reload={load} report={setNotice} />
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center text-slate-400"><div><BriefcaseBusiness className="mx-auto mb-3 h-10 w-10" /><p>新增第一個案件，或稍後匯入案件 ZIP</p></div></div>
        )}
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{draft.id ? '編輯案件' : '新增案件'}</h2>
              <button type="button" onClick={() => setEditing(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">收文日期<input type="date" value={draft.receiveDate} onChange={(e) => setDraft({...draft, receiveDate:e.target.value})} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-slate-600">文號<input value={draft.externalKey} onChange={(e) => setDraft({...draft, externalKey:e.target.value})} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" /></label>
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-600">主旨<input required value={draft.subject} onChange={(e) => setDraft({...draft, subject:e.target.value})} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" /></label>
            <label className="mt-4 block text-xs font-medium text-slate-600">內容<textarea rows={6} value={draft.content} onChange={(e) => setDraft({...draft, content:e.target.value})} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" /></label>
            <label className="mt-4 block text-xs font-medium text-slate-600">備註<textarea rows={2} value={draft.note} onChange={(e) => setDraft({...draft, note:e.target.value})} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" /></label>
            <label className="mt-4 block text-xs font-medium text-slate-600">狀態<select value={draft.status} onChange={(e) => setDraft({...draft, status:e.target.value as CaseStatus})} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="open">待處理</option><option value="doing">處理中</option><option value="done">已完成</option>
            </select></label>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-md border px-4 py-2 text-sm">取消</button>
              <button disabled={busy} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" />儲存</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
