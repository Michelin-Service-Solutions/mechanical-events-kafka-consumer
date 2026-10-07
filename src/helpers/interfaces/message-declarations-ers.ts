import type { FnaCaseRecord } from '../services/mechanical-email';

export interface DMSMessage {
  data: FnaCaseRecord;
  metadata: DocumentsMetadata;
}

export interface DocumentsMetadata {
  timestamp: string;
  "record-type": string;
  operation: string;
  "partition-key-type": string;
  "schema-name": string;
  "table-name": string;
  "transaction-id": number;
}

export interface RetryCaseData {
  id: string;
  case_number: string;
  status?: string;
  nextRetry: string;
  retryNumber: number;
  caseData: FnaCaseRecord;
}
