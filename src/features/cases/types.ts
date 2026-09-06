export type CaseStatus = 'open' | 'doing' | 'done' | 'archived';
export type DeliveryStatus = 'open' | 'doing' | 'done';
export type DocumentStatus = 'missing' | 'draft' | 'ready' | 'submitted';
export type DocumentFormat =
  | 'doc' | 'docx' | 'xls' | 'xlsx' | 'pdf' | 'csv' | 'txt'
  | 'paper' | 'online_form' | 'other';
export type DocumentRole = 'template' | 'draft' | 'final';
export type DocumentSourceType =
  | 'official_template'
  | 'reconstructed'
  | 'generated'
  | 'user_upload'
  | 'chatgpt_output';

export interface CasePackageV1 {
  schemaVersion: '1.0';
  packageId: string;
  generatedAt: string;
  generator?: string;
  case: {
    receiveDate: string | null;
    externalKey: string | null;
    subject: string;
    content: string;
    note: string;
    status: CaseStatus;
  };
  deliveries: Array<{
    id: string;
    channel: string;
    deadline: string | null;
    status: DeliveryStatus;
    detail: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    format: DocumentFormat;
    sourceType: DocumentSourceType;
    reference: string;
    status: DocumentStatus;
    deliveryIds: string[];
  }>;
  artifacts: Array<{
    id: string;
    documentId: string;
    path: string;
    fileName: string;
    mediaType: string;
    byteSize: number;
    sha256: string;
    role: DocumentRole;
    sourceType: DocumentSourceType;
    versionLabel: string;
    isCurrent: boolean;
  }>;
  warnings: string[];
}

export interface CaseRecord {
  id: string;
  userId: string;
  sourcePackageId: string | null;
  receiveDate: string | null;
  externalKey: string | null;
  subject: string;
  content: string;
  note: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export const CASE_PACKAGE_SCHEMA_VERSION = '1.0' as const;
export const CASE_FILES_BUCKET = 'case-files' as const;
