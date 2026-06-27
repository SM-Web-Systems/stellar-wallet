import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWalletStore } from "../store/wallet";
import { nftApi } from "../lib/api";
import { Loader2, Image, ExternalLink, RefreshCw } from "lucide-react";

export default function NftsPage() {
  const { t } = useTranslation();
  const activeAccount = useWalletStore((s) => {
    const id = s.activeAccountId;
    return s.accounts.find((a: any) => a.id === id);
  });

  const [indexedNfts, setIndexedNfts] = useState<any[]>([]);
  const [classicNfts, setClassicNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const publicKey = (activeAccount as any)?.publicKey;

  const fetchNfts = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await nftApi.tokensByOwner(publicKey, true);
      setIndexedNfts(data.indexed?.tokens || []);
      setClassicNfts(data.classicNfts || []);
    } catch (err: any) {
      setError(err.message || "Failed to load NFTs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNfts(); }, [publicKey]);

  const hasNfts = indexedNfts.length > 0 || classicNfts.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stellar-text">{t("nfts.title", "NFT Gallery")}</h1>
          <p className="text-sm text-stellar-muted mt-1">Soroban (SEP-50) and Classic (SEP-39) collectibles</p>
        </div>
        <button
          onClick={fetchNfts}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stellar-card border border-stellar-border text-sm text-stellar-muted hover:text-stellar-text transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-stellar-blue" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12 text-red-400">{error}</div>
      )}

      {!loading && !error && !hasNfts && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center">
            <Image size={36} className="text-stellar-muted" />
          </div>
          <p className="text-stellar-muted text-base">{t("nfts.empty", "No NFTs found")}</p>
          <p className="text-stellar-muted/50 text-sm mt-2">
            {t("nfts.emptyHint", "Soroban (SEP-50) and Classic (SEP-39) NFTs will appear here")}
          </p>
        </div>
      )}

      {indexedNfts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stellar-muted mb-3">Soroban NFTs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {indexedNfts.map((item: any) => (
              <div key={item.token.id} className="rounded-xl border border-stellar-border bg-stellar-card overflow-hidden hover:border-stellar-blue/40 transition-colors cursor-pointer group">
                {item.token.imageUrl ? (
                  <img src={item.token.imageUrl} alt={item.token.name || "NFT"} className="w-full h-40 object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center">
                    <Image size={32} className="text-stellar-muted/30" />
                  </div>
                )}
                <div className="p-3">
                  <p className="font-medium text-sm text-stellar-text truncate">{item.token.name || `#${item.token.tokenIdentifier}`}</p>
                  {item.collection && (
                    <p className="text-xs text-stellar-muted truncate mt-0.5">{item.collection.name}{item.collection.symbol ? ` · ${item.collection.symbol}` : ""}</p>
                  )}
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">SEP-50</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {classicNfts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stellar-muted mb-3">Classic Assets (SEP-39)</h2>
          <div className="space-y-2">
            {classicNfts.map((nft: any, i: number) => (
              <div key={`${nft.assetCode}-${i}`} className="flex items-center gap-4 p-4 rounded-xl border border-stellar-border bg-stellar-card hover:border-stellar-blue/40 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xl">💎</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-stellar-text">{nft.assetCode}</p>
                  <p className="text-xs text-stellar-muted">Supply: {nft.totalSupply} · Balance: {nft.balance}</p>
                  {nft.homeDomain && (
                    <a href={`https://${nft.homeDomain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-stellar-blue hover:underline inline-flex items-center gap-1 mt-0.5">
                      {nft.homeDomain} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {nft.isLocked && <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">Locked</span>}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">SEP-39</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
