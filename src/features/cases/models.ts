import type {
  CaseRecord,
  CaseStatus,
  DeliveryStatus,
  DocumentFormat,
  DocumentCategory,
  DocumentRole,
  DocumentSourceType,
  DocumentStatus,
} from './types';

export interface DeliveryRecord {
  id: string;
  caseId: string;
  channel: string;
  deadline: string | null;
  status: DeliveryStatus;
  detail: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDocumentRecord {
  id: string;
  caseId: string;
  name: string;
  format: DocumentFormat;
  sourceType: DocumentSourceType;
  reference: string;
  status: DocumentStatus;
  category: DocumentCategory;
  required: boolean;
  completedAt: string | null;
  submittedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  role: DocumentRole;
  sourceType: DocumentSourceType;
  versionNumber: number;
  versionLabel: string;
  fileName: string;
  storagePath: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface CaseDocumentWithRelations extends CaseDocumentRecord {
  deliveryIds: string[];
  versions: DocumentVersionRecord[];
}

export interface CaseAggregate extends CaseRecord {
  deliveries: DeliveryRecord[];
  documents: CaseDocumentWithRelations[];
}

export interface CreateCaseInput {
  sourcePackageId?: string | null;
  receiveDate?: string | null;
  externalKey?: string | null;
  subject: string;
  content?: string;
  note?: string;
  status?: CaseStatus;
}

export interface CreateDeliveryInput {
  caseId: string;
  channel: string;
  deadline?: string | null;
  status?: DeliveryStatus;
  detail?: string;
  sortOrder?: number;
}

export interface CreateDocumentInput {
  caseId: string;
  name: string;
  format?: DocumentFormat;
  sourceType?: DocumentSourceType;
  reference?: string;
  status?: DocumentStatus;
  category?: DocumentCategory;
  required?: boolean;
  sortOrder?: number;
  deliveryIds?: string[];
}

export interface UploadVersionInput {
  caseId: string;
  documentId: string;
  file: File;
  role: DocumentRole;
  sourceType: DocumentSourceType;
  versionLabel: string;
  makeCurrent?: boolean;
}
