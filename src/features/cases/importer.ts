import { supabase } from '@/lib/supabase';
import { createCase, createDelivery, createDocument, uploadDocumentVersion } from './repository';
import type { CasePackageV1 } from './types';
import { readSafeZip } from './zip';

const allowedExtensions = new Set(['doc', 'docx', 'xls', 'xlsx', 'pdf', 'csv', 'txt', 'jpg', 'jpeg', 'png']);
const allowedRoles = new Set(['template', 'draft', 'final']);
const allowedSources = new Set(['official_template', 'reconstructed', 'generated', 'user_upload', 'chatgpt_output']);

export interface ImportDuplicate {
  id: string;
  subject: string;
  reason: string;
}

export interface CasePackagePreview {
  file: File;
  packageHash: string;
  manifest: CasePackageV1;
  entries: Map<string, Uint8Array>;
  duplicates: ImportDuplicate[];
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function digest(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const source = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
  const hash = await crypto.subtle.digest('SHA-256', source as ArrayBuffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateManifest(value: unknown): asserts value is CasePackageV1 {
  if (!value || typeof value !== 'object') throw new Error('case.json 必須是 JSON 物件');
  const data = value as Partial<CasePackageV1>;
  if (data.schemaVersion !== '1.0') throw new Error('僅支援 schemaVersion 1.0');
  if (!isUuid(data.packageId)) throw new Error('packageId 必須是 UUID');
  if (!data.case || typeof data.case.subject !== 'string' || !data.case.subject.trim()) throw new Error('案件主旨不可空白');
  if (!Array.isArray(data.deliveries) || !Array.isArray(data.documents) || !Array.isArray(data.artifacts) || !Array.isArray(data.warnings)) throw new Error('case.json 缺少必要陣列');
  const deliveryIds = new Set(data.deliveries.map((item) => item.id));
  const documentIds = new Set(data.documents.map((item) => item.id));
  if (deliveryIds.size !== data.deliveries.length || documentIds.size !== data.documents.length) throw new Error('管道或文件 ID 重複');
  for (const document of data.documents) {
    if (!document.name?.trim()) throw new Error('繳交文件名稱不可空白');
    if (!document.deliveryIds.every((id) => deliveryIds.has(id))) throw new Error(`文件「${document.name}」引用不存在的繳交管道`);
  }
  for (const artifact of data.artifacts) {
    if (!documentIds.has(artifact.documentId)) throw new Error(`附件「${artifact.fileName}」引用不存在的文件`);
    if (!artifact.path.startsWith('files/') || artifact.path.includes('../')) throw new Error(`附件路徑不合法：${artifact.path}`);
    const extension = artifact.path.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedExtensions.has(extension)) throw new Error(`附件格式不允許：${artifact.path}`);
    if (!allowedRoles.has(artifact.role) || !allowedSources.has(artifact.sourceType)) throw new Error(`附件角色或來源不正確：${artifact.fileName}`);
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`附件缺少正確 SHA-256：${artifact.fileName}`);
  }
}

function normalizeSubject(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, '');
}

export async function previewCasePackage(file: File): Promise<CasePackagePreview> {
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('請選擇 ZIP 檔案');
  const entries = await readSafeZip(file);
  if (!entries.has('case.json')) throw new Error('ZIP 根目錄找不到 case.json');
  if ([...entries.keys()].filter((name) => name.endsWith('/case.json') || name === 'case.json').length !== 1) throw new Error('ZIP 只能包含一份 case.json');
  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder().decode(entries.get('case.json')));
  } catch {
    throw new Error('case.json 無法解析');
  }
  validateManifest(manifest);
  if (manifest.artifacts.length > 30) throw new Error('實體附件不可超過 30 個');
  for (const artifact of manifest.artifacts) {
    const bytes = entries.get(artifact.path);
    if (!bytes) throw new Error(`ZIP 缺少附件：${artifact.path}`);
    if (bytes.byteLength !== artifact.byteSize) throw new Error(`附件大小不符：${artifact.fileName}`);
    if (await digest(bytes) !== artifact.sha256) throw new Error(`附件校驗失敗：${artifact.fileName}`);
  }
  const { data: exact, error: exactError } = await supabase.from('case_imports').select('case_id,status').eq('package_id', manifest.packageId).maybeSingle();
  if (exactError) throw new Error(`重複檢查失敗：${exactError.message}`);
  if (exact) throw new Error('這個案件包已經匯入過，系統已阻擋重複匯入');

  const { data: candidates, error } = await supabase.from('cases').select('id,subject,receive_date,external_key').is('deleted_at', null);
  if (error) throw new Error(`案件比對失敗：${error.message}`);
  const normalized = normalizeSubject(manifest.case.subject);
  const duplicates: ImportDuplicate[] = [];
  for (const row of candidates ?? []) {
    if (manifest.case.externalKey && row.external_key === manifest.case.externalKey) {
      duplicates.push({ id: row.id, subject: row.subject, reason: '文號相同' });
    } else if (manifest.case.receiveDate && row.receive_date === manifest.case.receiveDate && normalizeSubject(row.subject) === normalized) {
      duplicates.push({ id: row.id, subject: row.subject, reason: '收文日期與主旨相同' });
    }
  }
  return { file, packageHash: await digest(await file.arrayBuffer()), manifest, entries, duplicates };
}

export async function commitCasePackage(preview: CasePackagePreview, forceImport: boolean): Promise<string> {
  if (preview.duplicates.length && !forceImport) throw new Error('發現疑似重複案件，請確認後再匯入');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('請先登入');
  const manifest = preview.manifest;
  const { data: importRow, error: importError } = await supabase.from('case_imports').insert({
    package_id: manifest.packageId,
    schema_version: manifest.schemaVersion,
    package_sha256: preview.packageHash,
    status: 'committing',
    force_import: forceImport,
  }).select('id').single();
  if (importError) throw new Error(`建立匯入紀錄失敗：${importError.message}`);

  let caseId: string | null = null;
  try {
    const createdCase = await createCase({
      sourcePackageId: manifest.packageId,
      receiveDate: manifest.case.receiveDate,
      externalKey: forceImport ? null : manifest.case.externalKey,
      subject: manifest.case.subject,
      content: manifest.case.content,
      note: [manifest.case.note, ...manifest.warnings.map((warning) => `匯入提醒：${warning}`)].filter(Boolean).join('\n'),
      status: manifest.case.status,
    });
    caseId = createdCase.id;
    const deliveryMap = new Map<string, string>();
    for (let index = 0; index < manifest.deliveries.length; index += 1) {
      const source = manifest.deliveries[index];
      const created = await createDelivery({ caseId, channel: source.channel, deadline: source.deadline, status: source.status, detail: source.detail, sortOrder: index });
      deliveryMap.set(source.id, created.id);
    }
    const documentMap = new Map<string, string>();
    for (let index = 0; index < manifest.documents.length; index += 1) {
      const source = manifest.documents[index];
      const created = await createDocument({
        caseId,
        name: source.name,
        format: source.format,
        sourceType: source.sourceType,
        reference: source.reference,
        status: source.status,
        sortOrder: index,
        deliveryIds: source.deliveryIds.map((id) => deliveryMap.get(id)).filter((id): id is string => Boolean(id)),
      });
      documentMap.set(source.id, created.id);
    }
    for (const artifact of manifest.artifacts) {
      const documentId = documentMap.get(artifact.documentId);
      if (!documentId) throw new Error(`找不到附件對應文件：${artifact.fileName}`);
      const bytes = preview.entries.get(artifact.path);
      if (!bytes) throw new Error(`找不到附件：${artifact.fileName}`);
      await uploadDocumentVersion({
        caseId,
        documentId,
        file: new File([bytes], artifact.fileName, { type: artifact.mediaType }),
        role: artifact.role,
        sourceType: artifact.sourceType,
        versionLabel: artifact.versionLabel,
        makeCurrent: artifact.isCurrent,
      });
    }
    const { error: finishError } = await supabase.from('case_imports').update({ status: 'completed', case_id: caseId, completed_at: new Date().toISOString() }).eq('id', importRow.id);
    if (finishError) throw finishError;
    return caseId;
  } catch (error) {
    if (caseId) await supabase.from('cases').update({ status: 'archived', deleted_at: new Date().toISOString() }).eq('id', caseId);
    await supabase.from('case_imports').update({
      status: 'failed',
      case_id: caseId,
      error_code: 'IMPORT_FAILED',
      error_message: error instanceof Error ? error.message : String(error),
    }).eq('id', importRow.id);
    throw error;
  }
}
