import { auth } from "@/lib/auth";
import { serializeSignedCookie, parseCookies } from "better-call";
import { parseSetCookieHeader } from "better-auth/cookies";

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const parsedCookies = parseCookies(cookieHeader);
    const sessionCookie =
      parsedCookies.get("better-auth.session_token") ||
      parsedCookies.get("__Secure-better-auth.session_token");

    if (sessionCookie) {
      return Response.json({ token: sessionCookie });
    }

    // Fallback: Check session from request headers
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.session?.token) {
      const secret = process.env.BETTER_AUTH_SECRET;
      if (secret) {
        const raw = await serializeSignedCookie("token", session.session.token, secret);
        const parsed = parseSetCookieHeader(raw);
        const signedToken = parsed.get("token")?.value;
        if (signedToken) {
          return Response.json({ token: signedToken });
        }
      }
      return Response.json({ token: session.session.token });
    }

    return Response.json({ token: null }, { status: 401 });
  } catch (err) {
    if (err?.digest?.startsWith("NEXT_")) throw err;
    console.error("Error in /api/auth/token:", err);
    return Response.json({ error: "Failed to retrieve token" }, { status: 500 });
  }
}
