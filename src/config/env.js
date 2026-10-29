import dotenv from "dotenv";

dotenv.config();

function readPort(value) {
  if (value === undefined || value === "") return 4721;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${value}". Use an integer from 1 to 65535.`);
  }
  return port;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: readPort(process.env.PORT),
  mongoUri: process.env.MONGODB_URI?.trim() || "",
};
