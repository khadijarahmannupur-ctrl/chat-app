import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_CLIENT_URL || "http://localhost:3000",
  fetchOptions: {
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get("set-auth-token");
      if (authToken && typeof window !== "undefined") {
        localStorage.setItem("bearer_token", authToken);
      }
    },
    auth: {
      type: "Bearer",
      token: () =>
        typeof window !== "undefined"
          ? localStorage.getItem("bearer_token") || ""
          : "",
    },
  },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
