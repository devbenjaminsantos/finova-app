import {
  History,
  House,
  CalendarDays,
  ReceiptText,
  ScanSearch,
  WalletCards,
} from "lucide-react";

export const PRIMARY_NAV_ITEMS = [
  { to: "/", labelKey: "navbar.home", icon: House, end: true },
  { to: "/transacoes", labelKey: "navbar.transactions", icon: ReceiptText },
  { to: "/planejamento", labelKey: "navbar.planning", icon: CalendarDays },
  { to: "/analises", labelKey: "navbar.analyses", icon: ScanSearch },
  { to: "/contas", labelKey: "navbar.accounts", icon: WalletCards },
];

export const SECONDARY_NAV_ITEMS = [
  { to: "/historico", labelKey: "navbar.history", icon: History },
];

export const MOBILE_PRIMARY_ITEMS = [PRIMARY_NAV_ITEMS[0], PRIMARY_NAV_ITEMS[2]];
export const MOBILE_SECONDARY_ITEMS = [PRIMARY_NAV_ITEMS[1]];
export const MOBILE_MORE_ITEMS = [PRIMARY_NAV_ITEMS[3], PRIMARY_NAV_ITEMS[4], ...SECONDARY_NAV_ITEMS];
