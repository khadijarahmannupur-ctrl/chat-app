import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME || "chat_app");

export const auth = betterAuth({
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  trustedOrigins: [
    process.env.CLIENT_SIDE_PUBLIC_URL || "http://localhost:3000",
    process.env.SERVER_SIDE_PUBLIC_URL || "http://localhost:5000",
    "http://localhost:3000",
    "http://localhost:5000",
  ],
  advanced: {
    useSecureCookies: false,
  },
});