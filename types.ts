
export type ModificationType = 
  | "ADDED_TEXT" 
  | "DELETED_TEXT" 
  | "CHANGED_WORDING" 
  | "CHANGED_TIME_PERIOD" 
  | "CHANGED_AMOUNT" 
  | "NEW_CLAUSE_ONLY" 
  | "DELETED_CLAUSE";

export type ModificationColor = "green" | "red" | "orange" | "purple" | "blue";

export type ConditionType = 'General' | 'Particular';

export type TimeFrameType = 
  | "NOTICE_PERIOD"
  | "PAYMENT_PERIOD"
  | "RESPONSE_TIME"
  | "TIME_FOR_COMPLETION"
  | "EXTENSION_OF_TIME"
  | "DEFECTS_LIABILITY_PERIOD"
  | "GENERAL_DURATION";

export type ObligationParty = 
  | "Contractor"
  | "Employer"
  | "Engineer/Project Manager"
  | "Other/Unclear";

export interface TimeFrame {
  original_phrase: string;
  type: TimeFrameType;
  applies_to: ObligationParty;
  short_explanation: string;
}

export interface ComparisonDetail {
  type: ModificationType;
  color: ModificationColor;
  excerpt_general: string;
  excerpt_particular: string;
  comment: string;
}

export interface Clause {
  clause_number: string;
  clause_title: string;
  condition_type: ConditionType;
  clause_text: string;
  general_condition?: string;
  particular_condition?: string;
  comparison: ComparisonDetail[];
  has_time_frame?: boolean;
  time_frames?: TimeFrame[];
}

export interface FileData {
  data: string;
  mimeType: string;
  name?: string;
}

export interface DualSourceInput {
  general: string | FileData;
  particular: string | FileData;
}

export interface SavedContract {
  id: string;
  name: string;
  timestamp: number;
  clauses: Clause[];
  metadata: {
    totalClauses: number;
    generalCount: number;
    particularCount: number;
    highRiskCount: number;
    conflictCount: number;
    timeSensitiveCount?: number;
  };
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  LIBRARY = 'LIBRARY'
}

export interface ContractMeta {
  title: string;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
}

export type UserRole = 'admin' | 'editor' | 'viewer' | 'pending';
