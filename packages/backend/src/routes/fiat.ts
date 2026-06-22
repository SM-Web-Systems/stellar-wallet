import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth";
import { config } from "../config";

export async function fiatRampRoutes(app: FastifyInstance) {

  // Get supported fiat currencies and current rates
  app.get(
    "/api/v1/fiat/currencies",
    {
      schema: {
        tags: ["Fiat Ramp"],
        summary: "List supported fiat currencies with estimated XLM rates",
        response: {
          200: {
            type: "object",
            properties: {
              currencies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    code: { type: "string" },
                    name: { type: "string" },
                    symbol: { type: "string" },
                    minBuy: { type: "number" },
                    maxBuy: { type: "number" },
                    minSell: { type: "number" },
                    maxSell: { type: "number" },
                  },
                },
              },
              feePercent: { type: "number" },
              provider: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      return {
        currencies: [
          { code: "USD", name: "US Dollar", symbol: "$", minBuy: 10, maxBuy: 10000, minSell: 10, maxSell: 10000 },
          { code: "EUR", name: "Euro", symbol: "\u20ac", minBuy: 10, maxBuy: 10000, minSell: 10, maxSell: 10000 },
          { code: "GBP", name: "British Pound", symbol: "\u00a3", minBuy: 10, maxBuy: 10000, minSell: 10, maxSell: 10000 },
          { code: "ZAR", name: "South African Rand", symbol: "R", minBuy: 100, maxBuy: 100000, minSell: 100, maxSell: 100000 },
          { code: "NGN", name: "Nigerian Naira", symbol: "\u20a6", minBuy: 5000, maxBuy: 5000000, minSell: 5000, maxSell: 5000000 },
          { code: "KES", name: "Kenyan Shilling", symbol: "KSh", minBuy: 1000, maxBuy: 500000, minSell: 1000, maxSell: 500000 },
          { code: "BRL", name: "Brazilian Real", symbol: "R$", minBuy: 50, maxBuy: 50000, minSell: 50, maxSell: 50000 },
        ],
        feePercent: config.FIAT_RAMP_FEE_PERCENT,
        provider: config.FIAT_RAMP_PROVIDER,
      };
    }
  );

  // Get a buy quote (fiat -> XLM/token)
  app.post(
    "/api/v1/fiat/quote/buy",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["Fiat Ramp"],
        summary: "Get a quote to buy XLM or tokens with fiat",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["fiatCurrency", "fiatAmount"],
          properties: {
            fiatCurrency: { type: "string", description: "e.g. USD, EUR, ZAR" },
            fiatAmount: { type: "number", description: "Amount in fiat currency" },
            targetAsset: { type: "string", default: "XLM", description: "Asset to buy (default XLM)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              fiatCurrency: { type: "string" },
              fiatAmount: { type: "number" },
              targetAsset: { type: "string" },
              estimatedAmount: { type: "string" },
              rate: { type: "string" },
              fee: { type: "string" },
              feePercent: { type: "number" },
              totalFiat: { type: "number" },
              expiresAt: { type: "string" },
              quoteId: { type: "string" },
            },
          },
        },
      },
    },
    async (request) => {
      const { fiatCurrency, fiatAmount, targetAsset } = request.body as any;
      const asset = targetAsset || "XLM";

      // Fetch current XLM/USD price from a public source
      let xlmPrice = 0.09; // fallback
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=" + fiatCurrency.toLowerCase());
        const data = await res.json();
        if (data.stellar && data.stellar[fiatCurrency.toLowerCase()]) {
          xlmPrice = data.stellar[fiatCurrency.toLowerCase()];
        }
      } catch {
        // Use fallback price
      }

      const feeAmount = fiatAmount * (config.FIAT_RAMP_FEE_PERCENT / 100);
      const netFiat = fiatAmount - feeAmount;
      const estimatedXlm = xlmPrice > 0 ? netFiat / xlmPrice : 0;

      return {
        fiatCurrency,
        fiatAmount,
        targetAsset: asset,
        estimatedAmount: estimatedXlm.toFixed(7),
        rate: xlmPrice.toFixed(8),
        fee: feeAmount.toFixed(2),
        feePercent: config.FIAT_RAMP_FEE_PERCENT,
        totalFiat: fiatAmount,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        quoteId: crypto.randomUUID(),
      };
    }
  );

  // Get a sell quote (XLM/token -> fiat)
  app.post(
    "/api/v1/fiat/quote/sell",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["Fiat Ramp"],
        summary: "Get a quote to sell XLM or tokens for fiat",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["fiatCurrency", "cryptoAmount"],
          properties: {
            fiatCurrency: { type: "string" },
            cryptoAmount: { type: "number", description: "Amount of XLM/token to sell" },
            sourceAsset: { type: "string", default: "XLM" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              fiatCurrency: { type: "string" },
              sourceAsset: { type: "string" },
              cryptoAmount: { type: "number" },
              estimatedFiat: { type: "string" },
              rate: { type: "string" },
              fee: { type: "string" },
              feePercent: { type: "number" },
              netFiat: { type: "string" },
              expiresAt: { type: "string" },
              quoteId: { type: "string" },
            },
          },
        },
      },
    },
    async (request) => {
      const { fiatCurrency, cryptoAmount, sourceAsset } = request.body as any;
      const asset = sourceAsset || "XLM";

      let xlmPrice = 0.09;
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=" + fiatCurrency.toLowerCase());
        const data = await res.json();
        if (data.stellar && data.stellar[fiatCurrency.toLowerCase()]) {
          xlmPrice = data.stellar[fiatCurrency.toLowerCase()];
        }
      } catch {}

      const grossFiat = cryptoAmount * xlmPrice;
      const feeAmount = grossFiat * (config.FIAT_RAMP_FEE_PERCENT / 100);
      const netFiat = grossFiat - feeAmount;

      return {
        fiatCurrency,
        sourceAsset: asset,
        cryptoAmount,
        estimatedFiat: grossFiat.toFixed(2),
        rate: xlmPrice.toFixed(8),
        fee: feeAmount.toFixed(2),
        feePercent: config.FIAT_RAMP_FEE_PERCENT,
        netFiat: netFiat.toFixed(2),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        quoteId: crypto.randomUUID(),
      };
    }
  );

  // Execute buy order (placeholder - needs real payment provider)
  app.post(
    "/api/v1/fiat/buy",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["Fiat Ramp"],
        summary: "Execute a fiat buy order (requires payment provider integration)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["quoteId", "paymentMethod"],
          properties: {
            quoteId: { type: "string" },
            paymentMethod: { type: "string", description: "card, bank_transfer, mobile_money" },
            destinationAddress: { type: "string", description: "Stellar address to receive tokens" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              orderId: { type: "string" },
              redirectUrl: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: "pending_provider",
        message: "Fiat on-ramp requires a payment provider integration. Contact support to enable this feature.",
        orderId: crypto.randomUUID(),
        redirectUrl: null,
      };
    }
  );

  // Execute sell order (placeholder)
  app.post(
    "/api/v1/fiat/sell",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["Fiat Ramp"],
        summary: "Execute a fiat sell order (requires payment provider integration)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["quoteId"],
          properties: {
            quoteId: { type: "string" },
            bankDetails: {
              type: "object",
              properties: {
                bankName: { type: "string" },
                accountNumber: { type: "string" },
                routingNumber: { type: "string" },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              orderId: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: "pending_provider",
        message: "Fiat off-ramp requires a payment provider integration. Contact support to enable this feature.",
        orderId: crypto.randomUUID(),
      };
    }
  );
}
