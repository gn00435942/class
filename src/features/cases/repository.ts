import { supabase } from '@/lib/supabase';
import { CASE_FILES_BUCKET } from './types';
import type {
  CaseAggregate,
  CaseDocumentRecord,
  CaseDocumentWithRelations,
  CreateCaseInput,
  CreateDeliveryInput,
  CreateDocumentInput,
  DeliveryRecord,
  DocumentVersionRecord,
  UploadVersionInput,
} from './models';
import type {
  CaseRecord,
  CaseStatus,
  DeliveryStatus,
  DocumentRole,
  DocumentSourceType,
  DocumentStatus,
} from './types';

type DbRow = Record<string, unknown>;

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown Supabase error';
}

function fail(context: string, error: unknown): never {
  throw new Error(`${context}: ${message(error)}`);
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) fail('無法確認登入狀態', error);
  if (!data.user) throw new Error('請先登入後再操作案件');
  return data.user;
}

function toCase(row: DbRow): CaseRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sourcePackageId: row.source_package_id ? String(row.source_package_id) : null,
    receiveDate: row.receive_date ? String(row.receive_date) : null,
    externalKey: row.external_key ? String(row.external_key) : null,
    subject: String(row.subject ?? ''),
    content: String(row.content ?? ''),
    note: String(row.note ?? ''),
    status: row.status as CaseStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toDelivery(row: DbRow): DeliveryRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    channel: String(row.channel ?? ''),
    deadline: row.deadline ? String(row.deadline) : null,
    status: row.status as DeliveryStatus,
    detail: String(row.detail ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toDocument(row: DbRow): CaseDocumentRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    name: String(row.name ?? ''),
    format: row.format as CaseDocumentRecord['format'],
    sourceType: row.source_type as DocumentSourceType,
    reference: String(row.reference ?? ''),
    status: row.status as DocumentStatus,
    category: (row.category ?? 'deliverable') as CaseDocumentRecord['category'],
    required: Boolean(row.required ?? true),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toVersion(row: DbRow): DocumentVersionRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    role: row.role as DocumentRole,
    sourceType: row.source_type as DocumentSourceType,
    versionNumber: Number(row.version_number),
    versionLabel: String(row.version_label),
    fileName: String(row.file_name),
    storagePath: String(row.storage_path),
    mediaType: String(row.media_type),
    byteSize: Number(row.byte_size),
    sha256: String(row.sha256),
    isCurrent: Boolean(row.is_current),
    createdAt: String(row.created_at),
  };
}

export async function listCases(): Promise<CaseAggregate[]> {
  await requireUser();

  const { data: caseRows, error: caseError } = await supabase
    .from('cases')
    .select('*')
    .is('deleted_at', null)
    .order('receive_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (caseError) fail('讀取案件失敗', caseError);
  const cases = (caseRows ?? []).map((row) => toCase(row as DbRow));
  if (!cases.length) return [];

  const caseIds = cases.map((item) => item.id);
  const [{ data: deliveryRows, error: deliveryError }, { data: documentRows, error: documentError }] =
    await Promise.all([
      supabase.from('deliveries').select('*').in('case_id', caseIds).order('sort_order'),
      supabase.from('case_documents').select('*').in('case_id', caseIds).order('sort_order'),
    ]);

  if (deliveryError) fail('讀取交付管道失敗', deliveryError);
  if (documentError) fail('讀取繳交文件失敗', documentError);

  const deliveries = (deliveryRows ?? []).map((row) => toDelivery(row as DbRow));
  const documents = (documentRows ?? []).map((row) => toDocument(row as DbRow));
  const documentIds = documents.map((item) => item.id);

  let links: Array<{ document_id: string; delivery_id: string }> = [];
  let versions: DocumentVersionRecord[] = [];

  if (documentIds.length) {
    const [{ data: linkRows, error: linkError }, { data: versionRows, error: versionError }] =
      await Promise.all([
        supabase.from('document_deliveries').select('document_id,delivery_id').in('document_id', documentIds),
        supabase.from('document_versions').select('*').in('document_id', documentIds).order('version_number'),
      ]);

    if (linkError) fail('讀取文件交付關聯失敗', linkError);
    if (versionError) fail('讀取文件版本失敗', versionError);
    links = (linkRows ?? []) as Array<{ document_id: string; delivery_id: string }>;
    versions = (versionRows ?? []).map((row) => toVersion(row as DbRow));
  }

  const documentsWithRelations: CaseDocumentWithRelations[] = documents.map((document) => ({
    ...document,
    deliveryIds: links.filter((link) => link.document_id === document.id).map((link) => link.delivery_id),
    versions: versions.filter((version) => version.documentId === document.id),
  }));

  return cases.map((caseItem) => ({
    ...caseItem,
    deliveries: deliveries.filter((delivery) => delivery.caseId === caseItem.id),
    documents: documentsWithRelations.filter((document) => document.caseId === caseItem.id),
  }));
}

export async function createCase(input: CreateCaseInput): Promise<CaseRecord> {
  await requireUser();
  const { data, error } = await supabase
    .from('cases')
    .insert({
      source_package_id: input.sourcePackageId ?? null,
      receive_date: input.receiveDate ?? null,
      external_key: input.externalKey?.trim() || null,
      subject: input.subject.trim(),
      content: input.content ?? '',
      note: input.note ?? '',
      status: input.status ?? 'open',
    })
    .select()
    .single();

  if (error) fail('新增案件失敗', error);
  return toCase(data as DbRow);
}

export async function updateCase(
  id: string,
  patch: Partial<Pick<CreateCaseInput, 'receiveDate' | 'externalKey' | 'subject' | 'content' | 'note' | 'status'>>
): Promise<CaseRecord> {
  await requireUser();
  const payload: Record<string, unknown> = {};
  if ('receiveDate' in patch) payload.receive_date = patch.receiveDate ?? null;
  if ('externalKey' in patch) payload.external_key = patch.externalKey?.trim() || null;
  if ('subject' in patch) payload.subject = patch.subject?.trim() ?? '';
  if ('content' in patch) payload.content = patch.content ?? '';
  if ('note' in patch) payload.note = patch.note ?? '';
  if ('status' in patch) payload.status = patch.status;

  const { data, error } = await supabase.from('cases').update(payload).eq('id', id).select().single();
  if (error) fail('更新案件失敗', error);
  return toCase(data as DbRow);
}

export async function archiveCase(id: string): Promise<void> {
  await requireUser();
  const { error } = await supabase
    .from('cases')
    .update({ status: 'archived', deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) fail('封存案件失敗', error);
}

export async function createDelivery(input: CreateDeliveryInput): Promise<DeliveryRecord> {
  await requireUser();
  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      case_id: input.caseId,
      channel: input.channel.trim(),
      deadline: input.deadline ?? null,
      status: input.status ?? 'open',
      detail: input.detail ?? '',
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) fail('新增交付管道失敗', error);
  return toDelivery(data as DbRow);
}

export async function updateDelivery(
  id: string,
  patch: Partial<Omit<CreateDeliveryInput, 'caseId'>>
): Promise<DeliveryRecord> {
  await requireUser();
  const payload: Record<string, unknown> = {};
  if ('channel' in patch) payload.channel = patch.channel?.trim() ?? '';
  if ('deadline' in patch) payload.deadline = patch.deadline ?? null;
  if ('status' in patch) payload.status = patch.status;
  if ('detail' in patch) payload.detail = patch.detail ?? '';
  if ('sortOrder' in patch) payload.sort_order = patch.sortOrder;

  const { data, error } = await supabase.from('deliveries').update(payload).eq('id', id).select().single();
  if (error) fail('更新交付管道失敗', error);
  return toDelivery(data as DbRow);
}

export async function deleteDelivery(id: string): Promise<void> {
  await requireUser();
  const { error } = await supabase.from('deliveries').delete().eq('id', id);
  if (error) fail('刪除交付管道失敗', error);
}

export async function createDocument(input: CreateDocumentInput): Promise<CaseDocumentWithRelations> {
  await requireUser();
  const { data, error } = await supabase
    .from('case_documents')
    .insert({
      case_id: input.caseId,
      name: input.name.trim(),
      format: input.format ?? 'other',
      source_type: input.sourceType ?? 'generated',
      reference: input.reference ?? '',
      status: input.status ?? 'not_started',
      category: input.category ?? 'deliverable',
      required: input.required ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) fail('新增繳交文件失敗', error);
  const document = toDocument(data as DbRow);
  const deliveryIds = [...new Set(input.deliveryIds ?? [])];

  if (deliveryIds.length) {
    const { error: linkError } = await supabase
      .from('document_deliveries')
      .insert(deliveryIds.map((deliveryId) => ({ document_id: document.id, delivery_id: deliveryId })));
    if (linkError) {
      await supabase.from('case_documents').delete().eq('id', document.id);
      fail('建立文件交付關聯失敗', linkError);
    }
  }

  return { ...document, deliveryIds, versions: [] };
}

export async function replaceDocumentDeliveries(
  documentId: string,
  deliveryIds: string[]
): Promise<void> {
  await requireUser();
  const uniqueIds = [...new Set(deliveryIds)];
  const { error: deleteError } = await supabase
    .from('document_deliveries')
    .delete()
    .eq('document_id', documentId);
  if (deleteError) fail('更新文件交付關聯失敗', deleteError);

  if (uniqueIds.length) {
    const { error: insertError } = await supabase
      .from('document_deliveries')
      .insert(uniqueIds.map((deliveryId) => ({ document_id: documentId, delivery_id: deliveryId })));
    if (insertError) fail('更新文件交付關聯失敗', insertError);
  }
}

export async function updateDocument(
  id: string,
  patch: Partial<Omit<CreateDocumentInput, 'caseId' | 'deliveryIds'>>
): Promise<CaseDocumentRecord> {
  await requireUser();
  const payload: Record<string, unknown> = {};
  if ('name' in patch) payload.name = patch.name?.trim() ?? '';
  if ('format' in patch) payload.format = patch.format;
  if ('sourceType' in patch) payload.source_type = patch.sourceType;
  if ('reference' in patch) payload.reference = patch.reference ?? '';
  if ('status' in patch) payload.status = patch.status;
  if ('category' in patch) payload.category = patch.category;
  if ('required' in patch) payload.required = patch.required;
  if ('status' in patch) {
    payload.completed_at = ['completed', 'submitted'].includes(patch.status ?? '')
      ? new Date().toISOString()
      : null;
    payload.submitted_at = patch.status === 'submitted' ? new Date().toISOString() : null;
  }
  if ('sortOrder' in patch) payload.sort_order = patch.sortOrder;

  const { data, error } = await supabase.from('case_documents').update(payload).eq('id', id).select().single();
  if (error) fail('更新繳交文件失敗', error);
  return toDocument(data as DbRow);
}

export async function deleteDocument(id: string): Promise<void> {
  await requireUser();
  const { data: versionRows, error: versionError } = await supabase
    .from('document_versions')
    .select('storage_path')
    .eq('document_id', id);
  if (versionError) fail('讀取待刪除文件版本失敗', versionError);

  const paths = (versionRows ?? []).map((row) => String(row.storage_path));
  const { error } = await supabase.from('case_documents').delete().eq('id', id);
  if (error) fail('刪除繳交文件失敗', error);

  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(CASE_FILES_BUCKET).remove(paths);
    if (storageError) console.warn('文件資料已刪除，但部分實體檔案清理失敗', storageError);
  }
}

function safeFileName(name: string): string {
  const cleaned = name.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return cleaned || 'file';
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadDocumentVersion(input: UploadVersionInput): Promise<DocumentVersionRecord> {
  const user = await requireUser();
  const { data: document, error: documentError } = await supabase
    .from('case_documents')
    .select('id,case_id')
    .eq('id', input.documentId)
    .eq('case_id', input.caseId)
    .single();
  if (documentError) fail('找不到繳交文件', documentError);

  const { data: lastVersion, error: versionError } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', input.documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) fail('讀取文件版本失敗', versionError);

  const versionNumber = Number(lastVersion?.version_number ?? 0) + 1;
  const path = `${user.id}/${document.case_id}/${input.documentId}/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const hash = await sha256(input.file);

  const { error: uploadError } = await supabase.storage
    .from(CASE_FILES_BUCKET)
    .upload(path, input.file, { contentType: input.file.type || 'application/octet-stream', upsert: false });
  if (uploadError) fail('上傳文件失敗', uploadError);

  try {
    if (input.makeCurrent !== false) {
      const { error: currentError } = await supabase
        .from('document_versions')
        .update({ is_current: false })
        .eq('document_id', input.documentId)
        .eq('role', input.role)
        .eq('is_current', true);
      if (currentError) fail('更新目前文件版本失敗', currentError);
    }

    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: input.documentId,
        role: input.role,
        source_type: input.sourceType,
        version_number: versionNumber,
        version_label: input.versionLabel.trim(),
        file_name: input.file.name,
        storage_path: path,
        media_type: input.file.type || 'application/octet-stream',
        byte_size: input.file.size,
        sha256: hash,
        is_current: input.makeCurrent !== false,
      })
      .select()
      .single();

    if (error) fail('建立文件版本失敗', error);
    return toVersion(data as DbRow);
  } catch (error) {
    await supabase.storage.from(CASE_FILES_BUCKET).remove([path]);
    throw error;
  }
}

export async function getDocumentDownloadUrl(
  storagePath: string,
  expiresInSeconds = 60
): Promise<string> {
  await requireUser();
  const { data, error } = await supabase.storage
    .from(CASE_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) fail('建立文件下載連結失敗', error);
  return data.signedUrl;
}
