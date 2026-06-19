export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001", 10),
  STELLAR_NETWORK: process.env.STELLAR_NETWORK || "testnet",
  HORIZON_URL: process.env.HORIZON_URL || "https://horizon-testnet.stellar.org",
  SOROBAN_RPC_URL: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  WEB_APP_URL: process.env.WEB_APP_URL || "http://localhost:5173",
  API_BASE_URL: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || "3001"}`,
  JWT_SECRET: process.env.JWT_SECRET || "change-me-jwt-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "change-me-refresh-secret",
  JWT_EXPIRES_IN: parseInt(process.env.JWT_EXPIRES_IN || "900", 10),
  JWT_REFRESH_EXPIRES_IN: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "604800", 10),
};