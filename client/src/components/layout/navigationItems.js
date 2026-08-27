import {
  BarChart3,
  History,
  House,
  ReceiptText,
  ScanSearch,
  WalletCards,
} from "lucide-react";

export const PRIMARY_NAV_ITEMS = [
  { to: "/", labelKey: "navbar.home", icon: House, end: true },
  { to: "/graficos", labelKey: "navbar.charts", icon: BarChart3 },
  { to: "/transacoes", labelKey: "navbar.transactions", icon: ReceiptText },
  { to: "/analises", labelKey: "navbar.analyses", icon: ScanSearch },
  { to: "/contas", labelKey: "navbar.accounts", icon: WalletCards },
  { to: "/historico", labelKey: "navbar.history", icon: History },
];

export const MOBILE_PRIMARY_ITEMS = [PRIMARY_NAV_ITEMS[0], PRIMARY_NAV_ITEMS[3]];
export const MOBILE_SECONDARY_ITEMS = [PRIMARY_NAV_ITEMS[2], PRIMARY_NAV_ITEMS[4]];
export const MOBILE_MORE_ITEMS = [
  PRIMARY_NAV_ITEMS[1],
  PRIMARY_NAV_ITEMS[4],
  PRIMARY_NAV_ITEMS[5],
];
