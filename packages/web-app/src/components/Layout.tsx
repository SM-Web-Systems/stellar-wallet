import { useTranslation } from "react-i18next";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import EmailVerificationBanner from "./EmailVerificationBanner";
import {
  Coins,
  Send,
  QrCode,
  ArrowLeftRight,
  LogOut,
  Home,
  History as HistoryIcon,
  HelpCircle,
  Settings as SettingsIcon,
  Key,
} from "lucide-react";

import { useAuthStore } from "../store/auth";
import { useWalletStore } from "../store/wallet";
import AccountSwitcher from "./AccountSwitcher";
import clsx from "clsx";

export default function Layout() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const walletLogout = useWalletStore((s) => s.logout);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    walletLogout();
    navigate("/login");
  };

  const NAV = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: Home },
    { to: "/tokens", label: t("nav.tokens"), icon: Coins },
    { to: "/send", label: t("nav.send"), icon: Send },
    { to: "/receive", label: t("nav.receive"), icon: QrCode },
    { to: "/swap", label: t("nav.swap"), icon: ArrowLeftRight },
    { to: "/history", label: t("nav.history"), icon: HistoryIcon },
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon },
    { to: "/api-keys", label: t("nav.apiKeys", "API Keys"), icon: Key },
    { to: "/help", label: t("nav.help", "Help & FAQ"), icon: HelpCircle },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-stellar-border bg-stellar-card flex flex-col">
        <div className="p-3 border-b border-stellar-border">
          <AccountSwitcher />
        </div>

        {user && (
          <div className="px-4 py-3 border-b border-stellar-border">
            <p className="text-sm text-white font-medium truncate">
              {user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email}
            </p>
            <p className="text-xs text-stellar-muted truncate">{user.email}</p>
          </div>
        )}

        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-stellar-blue/20 text-white font-medium"
                    : "text-stellar-muted hover:text-white hover:bg-white/5"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-stellar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
            {t("settings.logout", "Sign Out")}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          <EmailVerificationBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
