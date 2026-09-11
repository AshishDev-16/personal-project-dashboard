export type PrStatus = "Merged" | "Open" | "Closed";
export type PaymentStatus = "Paid" | "Not Paid";

export interface DynamoTask {
  repo: string;
  category: string;
  prNumber: number;
  prTitle: string;
  forkUrl: string;
  prUrl: string;
  prStatus: PrStatus;
  merged: boolean;
  accepted: boolean;
  labels: string[];
}

export interface PaymentRecord {
  status: PaymentStatus;
  expectedAmount: number | null;
  receivedAmount: number | null;
  currency: "USD" | "INR";
  paidAt: string | null;
  reference: string;
  notes: string;
}

export type PaymentMap = Record<string, PaymentRecord>;

export type LumiereTaskStatus = "In Review" | "Fixing in Progress" | "Accepted" | "Rejected";

export interface LumiereTask {
  id: string;
  taskId: string;
  submissionDate: string;
  category: string;
  prompt: string;
  status: LumiereTaskStatus;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface LumiereSettings {
  amountPerAcceptedTask: number;
  currency: "USD" | "INR";
}

export interface LumiereState {
  tasks: LumiereTask[];
  settings: LumiereSettings;
}
