import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { tokenApi } from "../lib/api";
import { useBalances } from "../hooks/useBalances";
import TokenIcon from "../components/TokenIcon";
import { Search, Star, Loader2, Globe, List, Plus, Shield, X } from "lucide-react";
import { toast } from "sonner";

function formatRating(val: any): string {
  if (val == null) return "\u2014";
  const n = Number(val);
  return isNaN(n) ? "\u2014" : n.toFixed(1);
}

function normalizeToken(t: any) {
  return {
    assetCode: t.assetCode ?? t.asset_code ?? "",
    assetIssuer: t.assetIssuer ?? t.asset_issuer ?? "",
    assetType: t.assetType ?? t.asset_type ?? "",
    tomlName: t.tomlName ?? t.toml_name ?? "",
    tomlImage: t.tomlImage ?? t.toml_image ?? "",
    image: t.image ?? "",
    domain: t.domain ?? t.homeDomain ?? "",
    isVerified: t.isVerified ?? t.is_verified ?? false,
    isFeatured: t.isFeatured ?? t.is_featured ?? false,
    ratingAverage: t.ratingAverage ?? t.rating_average ?? null,
    trustlinesFunded: t.trustlinesFunded ?? t.trustlines_funded ?? null,
    source: t.source ?? "local",
  };
}

function unwrap(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.tokens)) return raw.tokens;
  return [];
}

async function fetchStellarExpertDirectory(): Promise<any[]> {
  const API_BASE = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${API_BASE}/api/v1/tokens/directory?order=desc&limit=500`);
  if (!res.ok) return [];
  const data = await res.json();
  const records = data._embedded?.records || [];

  return records.filter((r: any) => r.asset !== "XLM").map((r: any) => {
    const raw = r.asset || "";
    const firstDash = raw.indexOf("-");
    const lastDash = raw.lastIndexOf("-");
    const code = firstDash > 0 ? raw.substring(0, firstDash) : raw;
    const issuer =
      firstDash > 0 && lastDash > firstDash
        ? raw.substring(firstDash + 1, lastDash)
        : firstDash > 0
        ? raw.substring(firstDash + 1)
        : "";
    return {
      assetCode: code,
      assetIssuer: issuer,
      assetType: issuer === "" ? "native" : "credit_alphanum4",
      tomlName: r.tomlInfo?.name || r.tomlInfo?.orgName || "",
      tomlImage: r.tomlInfo?.image || "",
      image: r.tomlInfo?.image || "",
      domain: r.domain || "",
      isVerified: (r.rating?.average ?? 0) >= 6,
      isFeatured: false,
      ratingAverage: r.rating?.average ?? null,
      trustlinesFunded: r.trustlines?.funded ?? null,
      source: "stellar_expert",
    };
  });
}

type TabFilter = "all" | "featured" | "explore" | "trusted";

export default function TokensPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [tab, setTab] = useState<TabFilter>("all");
  const [showAddToken, setShowAddToken] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { data: balances } = useBalances();
  const trustedKeys = useMemo(() => {
    if (!balances) return new Set<string>();
    return new Set(balances.map((b: any) => `${b.assetCode}-${b.assetIssuer || "native"}`));
  }, [balances]);

  const {
    data: featuredRaw,
    isLoading: loadingFeatured,
    error: featuredError,
  } = useQuery({ queryKey: ["tokens-featured"], queryFn: tokenApi.featured });

  const {
    data: searchRaw,
    isLoading: loadingSearch,
    error: searchError,
  } = useQuery({
    queryKey: ["tokens-search", query, sortBy],
    queryFn: () => tokenApi.search(query, sortBy),
    enabled: query.length > 0,
  });

  const {
    data: directoryTokens = [],
    isLoading: loadingDirectory,
  } = useQuery({
    queryKey: ["stellar-expert-directory"],
    queryFn: fetchStellarExpertDirectory,
    staleTime: 5 * 60_000,
  });

  const featuredTokens = unwrap(featuredRaw).map(normalizeToken);
  const searchTokens = unwrap(searchRaw).map(normalizeToken);

  const allTokens = useMemo(() => {
    const map = new Map<string, any>();
    featuredTokens.forEach((tk) => map.set(`${tk.assetCode}-${tk.assetIssuer}`, tk));
    directoryTokens.forEach((tk: any) => {
      const key = `${tk.assetCode}-${tk.assetIssuer}`;
      if (!map.has(key)) map.set(key, tk);
    });
    const merged = Array.from(map.values());
    merged.sort((a, b) => (Number(b.ratingAverage) || 0) - (Number(a.ratingAverage) || 0));
    return merged;
  }, [featuredTokens, directoryTokens]);

  const trustedTokens = useMemo(() => {
    if (!balances) return [];
    return balances.map((b: any) => ({
      assetCode: b.assetCode,
      assetIssuer: b.assetIssuer || "native",
      assetType: b.assetType,
      tomlName: b.token?.tomlName || "",
      tomlImage: b.token?.tomlImage || "",
      image: b.token?.tomlImage || "",
      domain: b.token?.domain || "",
      isVerified: b.token?.isVerified || false,
      isFeatured: false,
      ratingAverage: b.token?.ratingAverage || null,
      trustlinesFunded: null,
      balance: b.balance,
      source: "trusted",
    }));
  }, [balances]);

  const displayTokens = useMemo(() => {
    if (query.length > 0) {
      const q = query.toLowerCase();
      const dirMatches = directoryTokens.filter(
        (tk: any) =>
          tk.assetCode.toLowerCase().includes(q) ||
          tk.tomlName.toLowerCase().includes(q) ||
          tk.domain.toLowerCase().includes(q)
      );
      const map = new Map<string, any>();
      searchTokens.forEach((tk) => map.set(`${tk.assetCode}-${tk.assetIssuer}`, tk));
      dirMatches.forEach((tk: any) => {
        const key = `${tk.assetCode}-${tk.assetIssuer}`;
        if (!map.has(key)) map.set(key, tk);
      });
      return Array.from(map.values());
    }
    switch (tab) {
      case "featured":
        return featuredTokens;
      case "explore": {
        const fKeys = new Set(featuredTokens.map((tk) => `${tk.assetCode}-${tk.assetIssuer}`));
        return directoryTokens.filter((tk: any) => !fKeys.has(`${tk.assetCode}-${tk.assetIssuer}`));
      }
      case "trusted":
        return trustedTokens;
      default:
        return allTokens;
    }
  }, [query, tab, searchTokens, featuredTokens, directoryTokens, allTokens, trustedTokens]);

  const isLoading = query.length > 0 ? loadingSearch : loadingFeatured || loadingDirectory;
  const error = query.length > 0 ? searchError : featuredError;

  // Smart token search handler
  const handleTokenSearch = useCallback(async (searchQuery: string) => {
    setTokenSearch(searchQuery);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await tokenApi.searchAssets(searchQuery, 20);
      setSearchResults((data.results || []).map(normalizeToken));
    } catch (err: any) {
      toast.error(err.message || "Search failed");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const getBalance = (code: string, issuer: string) => {
    if (!balances) return null;
    return balances.find(
      (b: any) => b.assetCode === code && (b.assetIssuer || "native") === (issuer || "native")
    );
  };

  const tabs: { key: TabFilter; icon: any; label: string; count: number }[] = [
    { key: "all", icon: List, label: t("tokens.allTokens", "All Tokens"), count: allTokens.length },
    { key: "featured", icon: Star, label: t("tokens.featured", "Featured"), count: featuredTokens.length },
    { key: "trusted", icon: Shield, label: t("tokens.trusted", "Trusted"), count: trustedTokens.length },
    { key: "explore", icon: Globe, label: t("tokens.explore", "Explore"), count: directoryTokens.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("tokens.title")}</h1>
          <p className="text-sm text-stellar-muted mt-1">
            {allTokens.length} {t("tokens.tokensAvailable", "tokens available")}
          </p>
        </div>
        <button
          onClick={() => setShowAddToken(!showAddToken)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stellar-blue text-white text-sm font-medium hover:bg-stellar-purple transition-colors"
        >
          {showAddToken ? <X size={16} /> : <Plus size={16} />}
          {showAddToken ? t("common.close", "Close") : t("tokens.addToken", "Add Token")}
        </button>
      </div>

      {/* Smart Token Search */}
      {showAddToken && (
        <div className="bg-stellar-card border border-stellar-border rounded-xl p-6 space-y-4">
          <h3 className="text-white font-medium">{t("tokens.findToken", "Find a Token")}</h3>
          <p className="text-xs text-stellar-muted">
            {t("tokens.findTokenDesc", "Search by asset code (e.g. USDC, BTC) or name. Results include verified assets from Stellar Expert and Horizon.")}
          </p>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stellar-muted" />
            <input
              type="text"
              value={tokenSearch}
              onChange={(e) => handleTokenSearch(e.target.value)}
              placeholder={t("tokens.searchByTicker", "Search by ticker or name (e.g. USDC, Bitcoin)...")}
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-stellar-bg border border-stellar-border text-white placeholder:text-stellar-muted focus:outline-none focus:border-stellar-blue"
            />
            {searching && (
              <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stellar-blue" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {searchResults.map((tk) => {
                const isTrusted = trustedKeys.has(`${tk.assetCode}-${tk.assetIssuer || "native"}`);
                return (
                  <button
                    key={`${tk.assetCode}-${tk.assetIssuer}`}
                    onClick={() => {
                      navigate(`/tokens/${encodeURIComponent(tk.assetCode)}/${encodeURIComponent(tk.assetIssuer || "native")}`);
                      setShowAddToken(false);
                      setTokenSearch("");
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center justify-between bg-stellar-bg border border-stellar-border rounded-lg px-4 py-3 hover:border-stellar-blue/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <TokenIcon code={tk.assetCode} image={tk.image || tk.tomlImage} size={32} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{tk.assetCode}</span>
                          {tk.isVerified && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-stellar-success/20 text-stellar-success font-medium">
                              VERIFIED
                            </span>
                          )}
                          {isTrusted && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-stellar-blue/20 text-stellar-blue font-medium">
                              TRUSTED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stellar-muted">
                          {tk.tomlName || tk.domain || ""}
                          {tk.assetIssuer && (
                            <span className="ml-1 font-mono">{tk.assetIssuer.slice(0, 8)}...{tk.assetIssuer.slice(-4)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {tk.ratingAverage != null && (
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-yellow-400" />
                          <span className="text-xs text-white">{formatRating(tk.ratingAverage)}</span>
                        </div>
                      )}
                      {tk.trustlinesFunded && (
                        <p className="text-[10px] text-stellar-muted">
                          {Number(tk.trustlinesFunded).toLocaleString()} holders
                        </p>
                      )}
                      <p className="text-[9px] text-stellar-muted/50 uppercase">{tk.source}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tokenSearch.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-sm text-stellar-muted text-center py-4">
              {t("tokens.noAssetsFound", "No assets found for")} "{tokenSearch}"
            </p>
          )}
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stellar-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("tokens.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-stellar-card border border-stellar-border text-white placeholder:text-stellar-muted focus:outline-none focus:border-stellar-blue"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-3 rounded-lg bg-stellar-card border border-stellar-border text-white focus:outline-none focus:border-stellar-blue"
        >
          <option value="rating">{t("tokens.sortRating")}</option>
          <option value="volume">{t("tokens.sortVolume")}</option>
          <option value="trustlines">{t("tokens.sortTrustlines")}</option>
          <option value="name">{t("tokens.sortName")}</option>
        </select>
      </div>

      {/* Tabs */}
      {query.length === 0 && (
        <div className="flex gap-2 flex-wrap">
          {tabs.map(({ key, icon: Icon, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-stellar-blue/20 text-stellar-blue border border-stellar-blue/40"
                  : "bg-stellar-card border border-stellar-border text-stellar-muted hover:text-white hover:border-stellar-blue/30"
              }`}
            >
              <Icon size={16} />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === key ? "bg-stellar-blue/30 text-stellar-blue" : "bg-stellar-border text-stellar-muted"
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-stellar-danger/10 border border-stellar-danger/30 rounded-lg p-4">
          <p className="text-sm text-stellar-danger">
            {t("tokens.failedToLoad", { error: (error as Error).message })}
          </p>
        </div>
      )}

      {/* Token List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-stellar-muted" size={32} />
        </div>
      ) : displayTokens.length === 0 && !error ? (
        <p className="text-stellar-muted text-center py-12">
          {query ? t("tokens.noSearchResults", { query }) : t("tokens.noFeatured")}
        </p>
      ) : (
        <div className="space-y-2">
          {displayTokens.map((tk) => {
            const isTrusted = trustedKeys.has(`${tk.assetCode}-${tk.assetIssuer || "native"}`);
            const bal = getBalance(tk.assetCode, tk.assetIssuer);
            return (
              <Link
                key={`${tk.assetCode}-${tk.assetIssuer}`}
                to={`/tokens/${encodeURIComponent(tk.assetCode)}/${encodeURIComponent(tk.assetIssuer || "native")}`}
                className={`flex items-center justify-between bg-stellar-card border rounded-xl px-5 py-4 hover:border-stellar-blue/50 transition-colors ${
                  isTrusted ? "border-stellar-blue/30" : "border-stellar-border"
                }`}
              >
                <div className="flex items-center gap-4">
                  <TokenIcon code={tk.assetCode} image={tk.image || tk.tomlImage} size={36} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{tk.assetCode}</p>
                      {tk.isVerified && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stellar-success/20 text-stellar-success font-medium">
                          {t("tokens.verified", "Verified").toUpperCase()}
                        </span>
                      )}
                      {tk.isFeatured && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-400 font-medium">
                          FEATURED
                        </span>
                      )}
                      {isTrusted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stellar-blue/20 text-stellar-blue font-medium flex items-center gap-0.5">
                          <Shield size={8} /> TRUSTED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stellar-muted">
                      {tk.tomlName || tk.domain || t("common.unknown")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {bal ? (
                    <>
                      <p className="text-sm font-mono text-white">
                        {parseFloat(bal.balance).toLocaleString(undefined, { maximumFractionDigits: 7 })}
                      </p>
                      <p className="text-xs text-stellar-muted">{tk.assetCode}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-400" />
                        <span className="text-sm text-white">{formatRating(tk.ratingAverage)}</span>
                      </div>
                      <p className="text-xs text-stellar-muted">
                        {tk.trustlinesFunded
                          ? `${Number(tk.trustlinesFunded).toLocaleString()} holders`
                          : ""}
                      </p>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!isLoading && !error && (
        <p className="text-xs text-stellar-muted text-center">
          {t("common.showing", {
            count: displayTokens.length,
            item: displayTokens.length !== 1 ? t("common.tokens") : t("common.token"),
          })}
        </p>
      )}
    </div>
  );
}
