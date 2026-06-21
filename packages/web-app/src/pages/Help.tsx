import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Wallet,
  ArrowLeftRight,
  Key,
  Mail,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

function FaqAccordion({ item, isOpen, toggle }: { item: FaqItem; isOpen: boolean; toggle: () => void }) {
  return (
    <div className="border border-stellar-border rounded-lg overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stellar-card/50 transition-colors"
      >
        <span className={"text-sm font-medium " + (isOpen ? "text-stellar-blue" : "text-white")}>{item.question}</span>
        {isOpen ? <ChevronUp size={16} className="text-stellar-blue shrink-0" /> : <ChevronDown size={16} className="text-stellar-muted shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-4 text-sm text-stellar-muted leading-relaxed">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const faqs: FaqItem[] = [
    {
      category: "getting-started",
      question: "What is Amma Wallet?",
      answer: "Amma Wallet is a web-based wallet for the Stellar blockchain. It lets you send and receive XLM and other Stellar tokens, swap assets on the decentralized exchange (DEX), manage trustlines, and secure your account with two-factor authentication. You can use it in self-custody mode (you control your keys) or delegated mode (keys encrypted on our server for convenience)."
    },
    {
      category: "getting-started",
      question: "How do I create an account?",
      answer: "Click Register on the login page. Enter your email and a strong password (minimum 8 characters). You will receive a verification email. Click the link in the email to verify your account. Once verified, you can create or import a Stellar wallet."
    },
    {
      category: "getting-started",
      question: "How do I create a wallet?",
      answer: "After logging in, go through the onboarding flow. You can either generate a new wallet (which gives you a mnemonic phrase to back up) or import an existing wallet using a secret key or mnemonic. Always store your mnemonic phrase or secret key securely offline. If you lose it, there is no way to recover your funds."
    },
    {
      category: "getting-started",
      question: "What is the difference between testnet and mainnet?",
      answer: "Testnet is a sandbox network where tokens have no real value. It is used for testing and development. Mainnet is the live Stellar network where tokens have real value. You can switch between them in Settings under Advanced Settings. New accounts default to testnet for safety."
    },
    {
      category: "wallets",
      question: "Can I have multiple wallets?",
      answer: "Yes. You can add multiple wallets to your account. Only one wallet is active at a time. The active wallet is used for all transactions (sending, swapping, trustlines). Switch your active wallet from the Wallets section or Settings."
    },
    {
      category: "wallets",
      question: "What is the difference between Self-Custody and Delegated mode?",
      answer: "In Self-Custody mode, your secret key stays on your device and never touches our servers. You sign transactions locally in your browser. In Delegated mode, your secret key is encrypted with a PIN and stored on our server. When you make a transaction, you enter your PIN and the server decrypts your key, signs the transaction, and submits it. Delegated mode enables features like automatic fee handling. You can switch modes in Settings under Advanced Settings."
    },
    {
      category: "wallets",
      question: "What happens if I lose my secret key or mnemonic?",
      answer: "If you are in self-custody mode and lose your secret key or mnemonic, your funds are permanently inaccessible. No one, including Amma Wallet, can recover them. Always keep your backup in a safe, offline location. In delegated mode, your encrypted key is stored on our server, but you still need your PIN to use it."
    },
    {
      category: "tokens",
      question: "What is a trustline?",
      answer: "On Stellar, you must explicitly trust a token before you can hold it. This is called a trustline. Adding a trustline tells the network you are willing to hold that specific token from a specific issuer. You can add trustlines from the token detail page. Each trustline requires a small reserve of 0.5 XLM."
    },
    {
      category: "tokens",
      question: "How do I find and add tokens?",
      answer: "Go to the Tokens page. You can browse all available tokens, search by name or code, or use the Add Token button to search across multiple sources (our database, Stellar Expert, and Horizon). Click on a token to see details and add a trustline."
    },
    {
      category: "tokens",
      question: "What is the trust score?",
      answer: "The trust score is a rating from Stellar Expert that evaluates tokens based on age, trading activity, number of trustlines, liquidity, trading volume, and interoperability. A score of 10 is the highest (like XLM). Scores below 3 indicate newer or less established tokens. Always do your own research before trusting a token."
    },
    {
      category: "trading",
      question: "How do I swap tokens?",
      answer: "Go to the Swap page. Select the token you want to sell and the token you want to buy. Enter the amount and click Get Quote. The system finds the best path through the Stellar DEX. Review the quote and confirm. A small platform fee may apply on swaps."
    },
    {
      category: "trading",
      question: "What fees are there?",
      answer: "Stellar network fees are very small (typically 0.00001 XLM per transaction). Amma Wallet charges a small platform fee only on swap operations (configurable by the platform). There are no fees on regular sends or receives. In delegated mode, the platform may pay the network fee for you via a fee bump transaction."
    },
    {
      category: "security",
      question: "How do I enable two-factor authentication (2FA)?",
      answer: "Go to Settings and find the Security section. You can enable 2FA using an authenticator app (TOTP), email codes, or a static code. We recommend using an authenticator app for the best security. Once enabled, you will need to enter a code each time you log in. Generate backup codes and store them safely in case you lose access to your 2FA method."
    },
    {
      category: "security",
      question: "How do I reset my password?",
      answer: "On the login page, click Forgot Password. Enter your email address and we will send you a reset link. The link is valid for 1 hour. Click it, enter your new password, and you are done. Resetting your password revokes all active sessions."
    },
    {
      category: "security",
      question: "Is my secret key safe?",
      answer: "In self-custody mode, your secret key never leaves your browser. We never see it. In delegated mode, your key is encrypted with your PIN using AES encryption before being stored. The PIN is never stored on our server. Without your PIN, the encrypted key is useless. We recommend using a strong, unique PIN."
    },
    {
      category: "security",
      question: "What is an API key?",
      answer: "API keys allow you to access the Amma Wallet API programmatically without using your email and password. This is useful for building bots, automated trading, or integrations. You can create and revoke API keys from the API Keys page. Each key has the same permissions as your account, so keep them secret."
    },
    {
      category: "troubleshooting",
      question: "I did not receive the verification email",
      answer: "Check your spam or junk folder. The email comes from our Gmail address. If you still do not see it, go to Settings and click Resend Verification Email. Make sure your email address is correct. If problems persist, try a different email provider."
    },
    {
      category: "troubleshooting",
      question: "My transaction failed",
      answer: "Common reasons: insufficient balance (remember to keep a minimum XLM reserve), missing trustline for the destination token, network congestion, or an invalid destination address. Check the error message for details. On testnet, you can fund your account using the friendbot from the dashboard."
    },
    {
      category: "troubleshooting",
      question: "I see zero balances after switching networks",
      answer: "Testnet and mainnet are completely separate networks. Wallets and balances on testnet do not exist on mainnet and vice versa. Make sure you are on the correct network in Settings under Advanced Settings."
    },
  ];

  const categories = [
    { key: "all", label: "All Questions", icon: HelpCircle },
    { key: "getting-started", label: "Getting Started", icon: Wallet },
    { key: "wallets", label: "Wallets", icon: Key },
    { key: "tokens", label: "Tokens", icon: ArrowLeftRight },
    { key: "trading", label: "Trading", icon: ArrowLeftRight },
    { key: "security", label: "Security", icon: Shield },
    { key: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
  ];

  const filtered = activeCategory === "all" ? faqs : faqs.filter(f => f.category === activeCategory);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("help.title", "Help & FAQ")}</h1>
        <p className="text-sm text-stellar-muted mt-1">{t("help.subtitle", "Find answers to common questions about Amma Wallet")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveCategory(key); setOpenIndex(null); }}
            className={"flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors " + (
              activeCategory === key
                ? "bg-stellar-blue/20 text-stellar-blue border border-stellar-blue/40"
                : "bg-stellar-card border border-stellar-border text-stellar-muted hover:text-white hover:border-stellar-blue/30"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((item, i) => (
          <FaqAccordion
            key={item.question}
            item={item}
            isOpen={openIndex === i}
            toggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>

      <div className="bg-stellar-card border border-stellar-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-medium">{t("help.moreHelp", "Need more help?")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://ammawallet.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-stellar-bg border border-stellar-border hover:border-stellar-blue/50 transition-colors"
          >
            <ExternalLink size={16} className="text-stellar-blue" />
            <div>
              <p className="text-sm font-medium text-white">API Documentation</p>
              <p className="text-xs text-stellar-muted">Interactive Swagger docs for developers</p>
            </div>
          </a>
          <a
            href="mailto:support@ammawallet.com"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-stellar-bg border border-stellar-border hover:border-stellar-blue/50 transition-colors"
          >
            <Mail size={16} className="text-stellar-blue" />
            <div>
              <p className="text-sm font-medium text-white">Contact Support</p>
              <p className="text-xs text-stellar-muted">Email us at support@ammawallet.com</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
