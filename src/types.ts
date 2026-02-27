export interface Member {
  id: number;
  name: string;
  email: string | null;
}

export interface MemberPayment {
  id: number;
  bill_id: number;
  member_id: number;
  amount: number;
  receipt_url: string | null;
  created_at: string;
  member_name?: string;
}

export interface MonthlyBill {
  id: number;
  month: number;
  year: number;
  payer_id: number;
  total_amount: number;
  receipt_url: string | null;
  created_at: string;
  payer_name?: string;
  payments: MemberPayment[];
}
