import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";
import { bearer } from "better-auth/plugins";
import { serializeSignedCookie } from "better-call";
import { parseSetCookieHeader } from "better-auth/cookies";

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME || "chat_app");

// Helper plugin: ensures both unsigned and signed bearer tokens are correctly processed
const unsignedTokenHelper = {
  id: "unsigned-token-helper",
  hooks: {
    before: [
      {
        matcher(context) {
          const authHeader =
            context.request?.headers.get("authorization") ||
            context.headers?.get("authorization");
          return Boolean(
            authHeader &&
            authHeader.slice(0, 7).toLowerCase() === "bearer " &&
            !authHeader.slice(7).trim().includes(".")
          );
        },
        handler: async (c) => {
          const authHeader =
            c.request?.headers.get("authorization") ||
            c.headers?.get("Authorization");
          const token = authHeader.slice(7).trim();
          if (!token || token.includes(".")) return;
          try {
            const raw = await serializeSignedCookie("token", token, c.context.secret);
            const parsed = parseSetCookieHeader(raw);
            const signedToken = parsed.get("token")?.value;
            if (signedToken) {
              const existingHeaders = c.request?.headers || c.headers;
              const headers = new Headers({
                ...Object.fromEntries(existingHeaders?.entries() || []),
              });
              headers.set("authorization", `Bearer ${signedToken}`);
              return { context: { headers } };
            }
          } catch (e) {
            // ignore
          }
        },
      },
    ],
  },
};

const trustedOrigins = Array.from(
  new Set(
    [
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_CLIENT_URL,
      process.env.NEXT_PUBLIC_SERVER_URL,
      process.env.CLIENT_SIDE_PUBLIC_URL,
      process.env.SERVER_SIDE_PUBLIC_URL,
      "http://localhost:3000",
      "http://localhost:5000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
    ].filter(Boolean)
  )
);

export const auth = betterAuth({
  database: mongodbAdapter(db),
  plugins: [unsignedTokenHelper, bearer()],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  trustedOrigins,
  advanced: {
    useSecureCookies: false,
  },
});
