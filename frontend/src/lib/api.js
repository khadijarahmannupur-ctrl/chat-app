export async function apiFetch(url, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

