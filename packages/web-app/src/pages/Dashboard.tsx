import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBalances } from "../hooks/useBalances";
import { useWalletStore } from "../store/wallet";
import TokenIcon from "../components/TokenIcon";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { t } = useTranslation();
  const publicKey = useWalletStore(
    (s) => s.accounts.find((a) => a.id === s.activeAccountId)?.publicKey ?? null
  );
  const { data: balances, isLoading } = useBalances();
  const totalXlm = balances?.find((b) => b.assetCode === "XLM")?.balance || "0";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stellar-text">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-stellar-muted font-mono">{publicKey}</p>
      </div>

      <div className="bg-gradient-to-br from-stellar-blue/30 to-stellar-purple/20 border border-stellar-border rounded-2xl p-8">
        <p className="text-sm text-stellar-muted">{t("dashboard.totalBalance")}</p>
        <p className="mt-2 text-4xl font-bold text-stellar-text">
          {parseFloat(totalXlm).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-stellar-text mb-4">{t("dashboard.yourAssets")}</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-stellar-muted" size={32} />
          </div>
        ) : !balances || balances.length === 0 ? (
          <p className="text-stellar-muted text-center py-12">{t("dashboard.noAssets")}</p>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <Link
                key={`${b.assetCode}-${b.assetIssuer}`}
                to={`/tokens/${encodeURIComponent(b.assetCode)}/${encodeURIComponent(b.assetIssuer || "native")}`}
                className="flex items-center justify-between bg-stellar-card border border-stellar-border rounded-xl px-5 py-4 hover:border-stellar-blue/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <TokenIcon code={b.assetCode} image={b.token?.tomlImage} size={36} />
                  <div>
                    <p className="font-medium text-stellar-text">{b.assetCode}</p>
                    <p className="text-xs text-stellar-muted">
                      {b.token?.tomlName || b.token?.domain || (b.assetType === "native" ? t("dashboard.stellarLumens") : b.assetIssuer?.slice(0, 12) + "...")}
                    </p>
                  </div>
                </div>
                <p className="font-mono text-stellar-text">
                  {parseFloat(b.balance).toLocaleString(undefined, { maximumFractionDigits: 7 })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}