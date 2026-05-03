export type PayTRGetTokenRequest = {
  merchant_id: string;
  user_ip: string;
  merchant_oid: string;
  email: string;
  payment_amount: number;
  currency: string;
  user_basket: string;
  no_installment: number;
  max_installment: number;
  paytr_token: string;
  user_name: string;
  user_address: string;
  user_phone: string;
  merchant_ok_url: string;
  merchant_fail_url: string;
  test_mode: number;
  debug_on: number;
  timeout_limit: number;
  lang: string;
}

export type PayTRGetTokenResponse = {
  status: string;
  reason?: string;
  errors?: Record<string, string>;
  token?: string;
}
