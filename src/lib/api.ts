const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

if (!API_URL) {
  console.error("NEXT_PUBLIC_API_URL is not set");
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
export function setToken(token: string) {
  localStorage.setItem("token", token);
}
export function logout() {
  localStorage.removeItem("token");
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    const msg = typeof data === "object" && (data as any)?.detail ? (data as any).detail : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// --- AUTH ---
export async function registerUser(payload: {
  phone: string;
  password: string;
  name: string;
  car_brand: string;
}) {
  return apiFetch("/register", { method: "POST", body: JSON.stringify(payload) });
}

// OAuth2 (form-urlencoded): username/password
export async function loginUser(phone: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", phone);
  form.append("password", password);

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Login failed");

  setToken(data.access_token);
  return data.access_token; 
}

export async function getProducts() {
  return apiFetch("/products");
}

export async function createOrder(payload: {
  items: { product_id: number; quantity: number }[];
  payment_method: string;
}) {
  return apiFetch("/orders", { method: "POST", body: JSON.stringify(payload) });
}

export async function getMyOrders() {
  return apiFetch("/orders");
}

// ---------- ADMIN ----------
export async function adminGetProducts() {
  return apiFetch("/admin/products");
}

export async function adminAddProduct(payload: {
  name: string;
  price: number;
  discount_percent: number;
}) {
  return apiFetch("/admin/products", { method: "POST", body: JSON.stringify(payload) });
}

export async function adminUpdateProduct(productId: number, payload: any) {
  return apiFetch(`/admin/products/${productId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function adminGetOrders(page: number, limit: number, q?: string, status: "all" | "pending" | "approved" | "rejected" = "all") {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (q && q.trim()) params.set("q", q.trim());
  if (status && status !== "all") params.set("status", status);

  return apiFetch(`/admin/orders?${params.toString()}`);
}

export async function adminGetOrdersCount() {
  return apiFetch("/admin/orders/count");
}

export async function adminApproveOrder(orderId: number) {
  return apiFetch(`/admin/orders/${orderId}/approve`, { method: "PATCH" });
}

export async function adminRejectOrder(orderId: number) {
  return apiFetch(`/admin/orders/${orderId}/reject`, { method: "PATCH" });
}

// downloads
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function adminDownloadOrdersExcel(dateFrom: string, dateTo: string) {
  const token = getToken();
  const res = await fetch(
    `${API_URL}/admin/reports/excel?date_from=${dateFrom}&date_to=${dateTo}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) throw new Error("Ошибка загрузки Excel");
  return await res.blob();
}

export async function adminDownloadClientExcel(userId: number, dateFrom: string, dateTo: string) {
  const token = getToken();
  const res = await fetch(
    `${API_URL}/admin/reports/client/${userId}/excel?date_from=${dateFrom}&date_to=${dateTo}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) throw new Error("Ошибка загрузки Excel по клиенту");
  return await res.blob();
}

export async function getMe() {
  return apiFetch("/me");
}

export async function adminGetOrderDetails(orderId: number) {
  return apiFetch(`/admin/orders/${orderId}`);
}
