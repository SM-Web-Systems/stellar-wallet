import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useWalletStore } from "../src/shared/store/wallet";

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const { createWallet, importWallet, accounts } = useWalletStore();
  const hasExisting = accounts.length > 0;

  const [mode, setMode] = useState<"choose" | "create" | "import">("choose");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (action === "create") setMode("create");
    else if (action === "import") setMode("import");
  }, [action]);

  const handleCreate = async () => {
    if (!name || pin.length < 6) { setError(t("onboarding.pinMin", "PIN must be at least 6 characters")); return; }
    setLoading(true);
    setError("");
    try {
      await createWallet(name, pin);
      router.replace("/(tabs)");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleImport = async () => {
    if (!name || pin.length < 6 || !secret.trim()) { setError(t("onboarding.fillAll", "Please fill all fields")); return; }
    setLoading(true);
    setError("");
    try {
      await importWallet(name, secret.trim(), pin);
      router.replace("/(tabs)");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const goBack = () => {
    if (hasExisting) router.back();
    else { setMode("choose"); setError(""); }
  };

  if (mode === "choose") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0e1a", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#3b82f6", marginBottom: 24 }} />
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Amma Wallet</Text>
        <Text style={{ color: "#6b7280", fontSize: 14, textAlign: "center", marginBottom: 32 }}>
          {t("onboarding.subtitle", "Your gateway to the Stellar network")}
        </Text>
        <TouchableOpacity
          onPress={() => setMode("create")}
          style={{ backgroundColor: "#3b82f6", borderRadius: 14, paddingVertical: 16, width: "100%", alignItems: "center", marginBottom: 12 }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{t("onboarding.createWallet", "Create New Wallet")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode("import")}
          style={{ borderWidth: 1, borderColor: "#1f2937", borderRadius: 14, paddingVertical: 16, width: "100%", alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{t("onboarding.importWallet", "Import Wallet")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0e1a", padding: 24, paddingTop: 60 }}>
      <TouchableOpacity onPress={goBack}>
        <Text style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
          ← {hasExisting ? t("common.backToDashboard", "Back") : t("common.back", "Back")}
        </Text>
      </TouchableOpacity>

      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
        {mode === "create" ? t("onboarding.createWallet", "Create New Wallet") : t("onboarding.importWallet", "Import Wallet")}
      </Text>
      {hasExisting && (
        <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>
          {t("accounts.addingNew", "Adding wallet")} ({accounts.length} {t("accounts.existing", "existing")})
        </Text>
      )}

      <TextInput value={name} onChangeText={setName} placeholder={t("onboarding.walletName", "Wallet name")} placeholderTextColor="#6b7280"
        style={{ backgroundColor: "#111827", borderWidth: 1, borderColor: "#1f2937", borderRadius: 12, color: "#fff", paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12 }} />
      <TextInput value={pin} onChangeText={setPin} placeholder={t("onboarding.enterPin", "PIN (min 6 characters)")} placeholderTextColor="#6b7280" secureTextEntry
        style={{ backgroundColor: "#111827", borderWidth: 1, borderColor: "#1f2937", borderRadius: 12, color: "#fff", paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12 }} />
      {mode === "import" && (
        <TextInput value={secret} onChangeText={setSecret} placeholder={t("onboarding.secretKey", "Secret key (S...)")} placeholderTextColor="#6b7280" multiline
          style={{ backgroundColor: "#111827", borderWidth: 1, borderColor: "#1f2937", borderRadius: 12, color: "#fff", paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12, height: 80, textAlignVertical: "top" }} />
      )}

      {error ? <Text style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      <TouchableOpacity
        onPress={mode === "create" ? handleCreate : handleImport}
        disabled={loading}
        style={{ backgroundColor: "#3b82f6", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: loading ? 0.5 : 1, marginTop: 8 }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : (
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            {mode === "create" ? t("onboarding.create", "Create") : t("onboarding.import", "Import")}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}