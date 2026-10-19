import { Banknote, CreditCard, Landmark, QrCode, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@/lib/api/types";

export const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  FONEPAY_QR: QrCode,
  ESEWA: Smartphone,
  KHALTI: Wallet,
  CARD: CreditCard,
  BANK_TRANSFER: Landmark,
};
