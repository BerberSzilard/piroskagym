
const TOKEN_KEY = "pg_token";



/* =========================

   Cookie helpers

========================= */



function getCookie(name) {

  if (typeof document === "undefined") return null;

  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));

  return m ? decodeURIComponent(m[2]) : null;

}



function setCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 7) {

  if (typeof document === "undefined") return;

  document.cookie = `${name}=${encodeURIComponent(

    value

  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;

}



function deleteCookie(name) {

  if (typeof document === "undefined") return;

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;

}



/* =========================

   Token handling

========================= */



export function getToken() {

  if (typeof window === "undefined") return null;



  // 1) localStorage

  const t = localStorage.getItem(TOKEN_KEY);

  if (t) return t;



  // 2) fallback cookie (direct /admin betöltéshez)

  return getCookie(TOKEN_KEY);

}



export function setToken(t) {

  if (typeof window === "undefined") return;

  localStorage.setItem(TOKEN_KEY, t);

  setCookie(TOKEN_KEY, t);

}



export function clearToken() {

  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);

  deleteCookie(TOKEN_KEY);

}



function redirectToLogin() {

  if (typeof window === "undefined") return;



  // ne csináljunk loopot, ha már a login oldalon vagyunk

  if (window.location.pathname === "/login") return;



  window.location.href = "/login";

}



/* =========================

   Auth API

========================= */



export async function login(email, password) {

  const res = await fetch("/api/auth/login", {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    cache: "no-store",

    body: JSON.stringify({ email, password }),

  });



  if (!res.ok) {

    let msg = "login_failed";

    try {

      const data = await res.json();

      msg = data?.error || msg;

    } catch {}

    throw new Error(msg);

  }



  const data = await res.json(); // { token, user }

  if (!data?.token) throw new Error("missing_token");



  setToken(data.token);

  return data.user;

}



export async function apiFetch(url, options = {}) {

  const headers = { ...(options.headers || {}) };



  // Ha van body, és nincs explicit Content-Type, akkor JSON-nak vesszük

if (options.body && !headers["Content-Type"]) {

  headers["Content-Type"] = "application/json";

}



  const token = getToken();

  if (token) {

    headers.Authorization = `Bearer ${token}`;

  }



  const res = await fetch(url, {

    ...options,

    headers,

    cache: "no-store",

  });



  // --- 401: automatikus token törlés + redirect loginra ---

  if (res.status === 401) {

  let msg = "unauthenticated";

  try {

    const data = await res.json();

    msg = data?.error || msg;

  } catch {}



  // ✅ 401 esetén mindig törlünk

  clearToken();



  // ✅ és mindig loginra vissza

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {

    window.location.href = "/login";

  }



  throw new Error(msg);

}



  if (res.status === 403) {

    throw new Error("forbidden");

  }



  if (!res.ok) {

    throw new Error("http_" + res.status);

  }



  return res.json();

}



export async function me() {

  try {

    const data = await apiFetch("/api/me");

    return data?.user || null;

  } catch {

    return null;

  }

}



export function logout() {

  clearToken();

  redirectToLogin();

}
