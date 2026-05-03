import {Hono} from "hono";
import {type Env} from "@/types/hono";
import crypto from "crypto";
import type {PayTRGetTokenRequest, PayTRGetTokenResponse} from "@/types/paytr/payTR";
import axios, {type AxiosResponse} from "axios";
import {authMiddleware} from "@/middleware/auth";
import {z} from "zod";
import {ObjectId} from "mongodb";
import {SubscriptionService} from "@/services/subscription.service";
import type {FIUser} from "@/types/user/fi_user";
import {AppError} from "@/middleware/error-handler";
import {subscriptionPlanSchema} from "@/types/subscription/subscription";
import {env} from "@/config/env";

// This is a helper class to generate merchant OID. Sipariş numarası üretiyoruz bununla tek amacımız o.
class MerchantOIDGenerator {

  generate(user: FIUser): string {
    return `${user.companyId}ID${new ObjectId()}`;
  }

  getCompanyId(oid: string): string {
    return oid.split("ID")[0]!;
  }

}

export const payTRRoutes = new Hono<Env>();
const subscriptionService = new SubscriptionService();
const merchantOIDGenerator = new MerchantOIDGenerator();
export const payTRPublicRoutes = new Hono<Env>();

const merchant_id = process.env.PAYTR_MERCHANT_ID!;
const merchant_key = process.env.PAYTR_MERCHANT_KEY!;
const merchant_salt = process.env.PAYTR_MERCHANT_SALT!;

payTRRoutes.use("*", authMiddleware)

const getTokenSchema = z.object({
  plan: subscriptionPlanSchema,
})

payTRRoutes.post("/token", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  if (!user.companyId) {
    throw new AppError(400, "Company ID not found", "COMPANY_ID_NOT_FOUND");
  }

  const subscription = await subscriptionService.getSubscription(user.companyId);

  if (subscription) {
    throw new AppError(400, "You already have a subscription", "SUBSCRIPTION_EXISTS");
  }

  const email = `company-${user.companyId!}@fiperde.com`;
  const user_ip = c.req.header("CF-Connecting-IP") || "127.0.0.1";

  const {
    plan,
  } = getTokenSchema.parse(body);
  const payment_amount = plan === "yearly" ? "1800000" : "180000";

  const merchant_oid = merchantOIDGenerator.generate(user);

  const user_basket = Buffer.from(
    JSON.stringify([["Product", "100.50", 1]])
  ).toString("base64");

  const no_installment = "0";
  const max_installment = "0";
  const currency = "TL";
  const test_mode = env.NODE_ENV === "development" ? "1" : "0";

  const hashSTR = `${merchant_id}${user_ip}${merchant_oid}${email}${payment_amount}${user_basket}${no_installment}${max_installment}${currency}${test_mode}`;
  const paytr_token = hashSTR + merchant_salt;

  const token = crypto.createHmac('sha256', merchant_key).update(paytr_token).digest('base64');

  // 📡 PAYTR REQUEST
  const params = new URLSearchParams();

  params.append("merchant_id", merchant_id);
  params.append("user_ip", user_ip);
  params.append("merchant_oid", merchant_oid);
  params.append("email", email);
  params.append("payment_amount", `${payment_amount}`);
  params.append("user_basket", user_basket);
  params.append("no_installment", "0");
  params.append("max_installment", "0");
  params.append("paytr_token", token);
  params.append("user_name", `${user.name} ${user.surname}`);
  params.append("user_address", "fiperde");
  params.append("user_phone", user.phoneNumber);
  params.append("merchant_ok_url", env.NODE_ENV === "development" ? "http://127.0.0.1:5173/subscription/success" : env.MERCHANT_OK_URL!);
  params.append("merchant_fail_url", env.NODE_ENV === "development" ? "http://127.0.0.1:5173/subscription/fail" : env.MERCHANT_FAIL_URL!);
  params.append("test_mode", test_mode);
  params.append("currency", currency);

  const res = await axios.post<PayTRGetTokenRequest, AxiosResponse<PayTRGetTokenResponse>>(
    "https://www.paytr.com/odeme/api/get-token",
    params,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },

    });

  const data = res.data;

  if (data.status !== "success") {
    return c.json({error: data.reason}, 400);
  }

  return c.json({
    token: data.token,
    merchant_oid,
  });
});

export type PayTRCallback = {
  merchant_oid: string;
  status: "success" | "failed";
  total_amount: string;
  hash: string
  failed_reason_code: string;
  failed_reason_msg: string;
  test_mode: string;
  payment_type: string;
  currency: string;
  payment_amount: string;
}

// After
payTRPublicRoutes.post("/callback", async (c) => {
  const callback = await c.req.parseBody<PayTRCallback>();

  const paytr_token = callback.merchant_oid + merchant_salt + callback.status + callback.total_amount;
  const token = crypto.createHmac('sha256', merchant_key).update(paytr_token).digest('base64');

  if (token !== callback.hash) {
    return c.text("HASH FAILED");
  }

  const companyId = merchantOIDGenerator.getCompanyId(callback.merchant_oid);

  if (callback.status === "success") {
    await subscriptionService.renewSubscription({
      companyId,
      paytrMerchantOid: callback.merchant_oid,
      paytrPaymentAmount: Number(callback.payment_amount),
    });
  }

  return c.text("OK");
});