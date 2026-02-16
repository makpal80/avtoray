"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminFromToken } from "@/lib/authClient";
import {
  adminAddProduct,
  adminApproveOrder,
  adminDownloadClientExcel,
  adminDownloadOrdersExcel,
  adminGetOrders,
  adminGetProducts,
  adminUpdateProduct,
  adminGetOrderDetails,
  downloadBlob,
  adminRejectOrder
} from "@/lib/api";
import { getToken, logout } from "@/lib/api";
import { adminAddProductType, adminDeleteProductType } from "@/lib/api";

type ProductType = {
  id: number;
  product_id: number;
  name: string;
  image_url: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  active: boolean;
  types?: ProductType[];
};

type Order = {
  id: number;
  user_name: string;
  user_id: number;
  user_car: string;
  total_amount: number;
  discount_percent: number;
  final_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
};


const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  bank: "Банк / перевод",
  installment: "Банк (рассрочка)",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидает",
  approved: "Подтверждён",
  rejected: "Отклонён",
};

function formatKZT(v: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.ceil(v)) + " ₸";
}



export default function AdminPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  // add product form
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("5");

  // reports
  const [dateFrom, setDateFrom] = useState("2026-01-01"); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState("2026-01-31");
  const [clientId, setClientId] = useState("");
  const [clientDateFrom, setClientDateFrom] = useState("2026-01-01"); // DD.MM.YYYY
  const [clientDateTo, setClientDateTo] = useState("2026-01-31");

  type OrderFilter = "all" | "pending" | "approved" | "rejected";
  const [filter, setFilter] = useState<OrderFilter>("pending");

  const [page, setPage] = useState(1);
  const limit = 10;
  const [qOrders, setQOrders] = useState("");
  const [total, setTotal] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [q, setQ] = useState("");

  // модалка
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<any>(null);

  // типы товаров
  const [typeName, setTypeName] = useState<Record<number, string>>({});
  const [typeFile, setTypeFile] = useState<Record<number, File | null>>({});


//   useEffect(() => {
//     if (!isAdminFromToken()) router.replace("/");
//   }, [router]);

//   const visibleOrders = useMemo(() => {
//     if (filter === "all") return orders;
//     return orders.filter((o) => o.status === filter);
//   }, [orders, filter]);

  function onLogout() {
    logout();
    router.replace("/");
   }


    async function loadProducts() {
    const p = await adminGetProducts();
    setProducts(p);
    }

    async function loadOrders() {
    const res = await adminGetOrders(page, limit, q, filter); 
    setOrders(res.items);
    setTotalOrders(res.total);
    }

    function changeFilter(next: OrderFilter) {
    setPage(1);       
    setFilter(next);   
    }

    useEffect(() => {
    (async () => {
        try {
        setMsg(null);
        await loadProducts(); // один раз
        setPage(1);           // просто сброс
        } catch (e: any) {
        setMsg("❌ " + e.message);
        }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
    (async () => {
        try {
        setMsg(null);
        await loadOrders(); // зависит от page / q / filter
        } catch (e: any) {
        setMsg("❌ " + e.message);
        }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, q, filter]);

    function onSearchOrders(value: string) {
    setQ(value);
    setPage(1);
    }

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "pending"),
    [orders]
  );

  async function onAddProduct() {
    setMsg(null);
    if (!newName.trim()) return setMsg("⚠️ Введи название товара");
    if (!newPrice.trim() || Number.isNaN(Number(newPrice))) return setMsg("⚠️ Введи цену числом");

    setLoading(true);
    try {
      await adminAddProduct({
        name: newName.trim(),
        price: Number(newPrice),
        discount_percent: Number(newDiscount) || 0,
      });
      setNewName("");
      setNewPrice("");
      setNewDiscount("5");
      await loadProducts();
      setMsg("✅ Товар добавлен");
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onAddType(productId: number) {
    setMsg(null);

    const name = (typeName[productId] ?? "").trim();
    const file = typeFile[productId];

    if (!name) return setMsg("⚠️ Введите название типа");
    if (!file) return setMsg("⚠️ Выберите фото типа");

    setLoading(true);
    try {
      await adminAddProductType(productId, name, file);
      setTypeName((p) => ({ ...p, [productId]: "" }));
      setTypeFile((p) => ({ ...p, [productId]: null }));
      await loadProducts();
      setMsg("✅ Тип добавлен");
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteType(typeId: number) {
    setMsg(null);
    setLoading(true);
    try {
      await adminDeleteProductType(typeId);
      await loadProducts();
      setMsg("✅ Тип удалён");
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
 }

  async function onUpdateProduct(id: number, payload: any) {
    setMsg(null);
    setLoading(true);
    try {
      await adminUpdateProduct(id, payload);
      await loadProducts();
      setMsg("✅ Сохранено");
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

    async function onApprove(orderId: number) {
        setMsg(null);
        setActionId(orderId);
        try {
            await adminApproveOrder(orderId);
            await loadOrders();
            setMsg(`✅ Заказ #${orderId} подтверждён`);
        } catch (e: any) {
            setMsg("❌ " + e.message);
        } finally {
            setActionId(null);
        }
    }

    async function onReject(orderId: number) {
    if (!confirm("Отклонить заказ?")) return;

    setMsg(null);
    setActionId(orderId);
    try {
        await adminRejectOrder(orderId);
        await loadOrders();
        setMsg(`⛔ Заказ #${orderId} отклонён`);
    } catch (e: any) {
        setMsg("❌ " + e.message);
    } finally {
        setActionId(null);
    }
    }

  async function onDownloadOrdersExcel() {
    setMsg(null);
    setLoading(true);
    try {
      const blob = await adminDownloadOrdersExcel(dateFrom, dateTo);
      downloadBlob(blob, `orders_${dateFrom}_to_${dateTo}.xlsx`);
      setMsg("✅ Отчёт скачан");
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onDownloadClientExcel() {
    setMsg(null);
    if (!clientId.trim()) return setMsg("⚠️ Введите Client ID");

    setLoading(true);
    try {
      const blob = await adminDownloadClientExcel(Number(clientId), clientDateFrom, clientDateTo);
      downloadBlob(blob, `client_${clientId}_${clientDateFrom}_to_${clientDateTo}.xlsx`);
      setMsg("✅ Отчёт по клиенту скачан");
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

    async function openOrder(id: number) {
    setOpen(true);
    setSelectedId(id);
    setDetails(null);

    try {
        const d = await adminGetOrderDetails(id);
        setDetails(d);
    } catch (e: any) {
        setMsg("❌ " + e.message);
        setOpen(false);
    }
    }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Админ-панель</h1>
            <div className="text-sm text-gray-500">Товары • Заказы • Отчёты Excel</div>
          </div>
            <div className="ml-auto flex gap-3">
            <button
                type="button"
                onClick={onLogout}
                className="text-sm underline"
            >
                Выйти
            </button>
            </div>
        </div>

        {msg && <div className="rounded-xl border bg-white p-3 text-sm">{msg}</div>}

        {/* PRODUCTS */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-semibold">Товары</h2>
              <p className="text-xs text-gray-500">Редактируйте прямо в таблице, сохранение по Enter или уходу из поля</p>
            </div>
            <button className="text-xs underline text-gray-600" onClick={loadOrders}>
              Обновить
            </button>
          </div>

          {/* Add product */}
          <div className="mt-4 flex flex-wrap gap-2 items-end">
            <div>
              <div className="text-xs text-gray-500">Название</div>
              <input className="border rounded px-2 py-2 w-64"
                value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-gray-500">Цена</div>
              <input className="border rounded px-2 py-2 w-32"
                value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-gray-500">Скидка %</div>
              <input className="border rounded px-2 py-2 w-24"
                value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
            </div>
            <button
              disabled={loading}
              onClick={onAddProduct}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Добавить
            </button>
          </div>

          {/* table */}
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">ID</th>
                  <th className="p-2 border text-left">Название</th>
                  <th className="p-2 border text-left">Цена</th>
                  <th className="p-2 border text-left">Скидка %</th>
                  <th className="p-2 border text-left">Типы</th>
                  <th className="p-2 border text-left">Active</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 border">{p.id}</td>

                    <td className="p-2 border">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        defaultValue={p.name}
                        onBlur={(e) => onUpdateProduct(p.id, { name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>

                    <td className="p-2 border">
                      <input
                        className="border rounded px-2 py-1 w-36"
                        defaultValue={p.price}
                        onBlur={(e) => onUpdateProduct(p.id, { price: Number((e.target as HTMLInputElement).value) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>

                    <td className="p-2 border">
                      <input
                        className="border rounded px-2 py-1 w-24"
                        defaultValue={p.discount_percent}
                        onBlur={(e) => onUpdateProduct(p.id, { discount_percent: Number((e.target as HTMLInputElement).value) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>

                    <td className="p-2 border align-top">
                      {/* список типов */}
                      <div className="flex flex-wrap gap-2">
                        {(p.types ?? []).map((t) => (
                          <div key={t.id} className="flex items-center gap-2 border rounded-lg px-2 py-1 text-xs">
                            <a href={t.image_url} target="_blank" className="underline">
                              {t.name}
                            </a>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => onDeleteType(t.id)}
                              className="text-red-600 underline disabled:opacity-50"
                            >
                              удалить
                            </button>
                          </div>
                        ))}
                        {(p.types ?? []).length === 0 && <span className="text-xs text-gray-400">нет</span>}
                      </div>

                      {/* добавление */}
                      <div className="mt-2 grid gap-2">
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Название типа"
                          value={typeName[p.id] ?? ""}
                          onChange={(e) => setTypeName((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setTypeFile((prev) => ({ ...prev, [p.id]: f }));
                          }}
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => onAddType(p.id)}
                          className="rounded-lg bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
                        >
                          + Добавить тип
                        </button>
                      </div>
                    </td>

                    <td className="p-2 border">
                      <input
                        type="checkbox"
                        defaultChecked={p.active}
                        onChange={(e) => onUpdateProduct(p.id, { active: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ORDERS */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-semibold">Заказы</h2>
              <div className="text-xs text-gray-500">Всего: {totalOrders} шт.</div>
            </div>
            <div className="text-xs text-gray-500">{pendingOrders.length} шт. ожидают</div>
          </div>

          
            <div className="flex-1 min-w-[220px]">
                <div className="text-xs text-gray-500">Поиск по имени</div>
                <input
                className="border rounded px-3 py-2"
                placeholder="Поиск по имени"
                value={q}
                onChange={(e) => {
                    setPage(1); 
                    setQ(e.target.value);
                }}
                />
            </div>

          <div className="mt-3 flex gap-2">
            <button
            onClick={() => changeFilter("all")}
            className={`px-3 py-2 border rounded ${filter === "all" ? "bg-black text-white" : ""}`}
            >
            Все
            </button>

            <button
            onClick={() => changeFilter("pending")}
            className={`px-3 py-2 border rounded ${filter === "pending" ? "bg-black text-white" : ""}`}
            >
            Ожидают
            </button>

            <button
            onClick={() => changeFilter("approved")}
            className={`px-3 py-2 border rounded ${filter === "approved" ? "bg-black text-white" : ""}`}
            >
            Подтверждённые
            </button>

            <button
            onClick={() => {
                setPage(1);
                setFilter("rejected");
            }}
            className={`border rounded px-4 py-2 ${filter === "rejected" ? "bg-black text-white" : ""}`}
            >
            Отклонённые
            </button>


            </div>


          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">ID</th>
                  <th className="p-2 border text-left">User ID</th>
                  <th className="p-2 border text-left">Клиент</th>
                  <th className="p-2 border text-left">Авто</th>
                  <th className="p-2 border text-left">Оплата</th>
                  <th className="p-2 border text-left">Сумма</th>
                  <th className="p-2 border text-left">Скидка</th>
                  <th className="p-2 border text-left">К оплате</th>
                  <th className="p-2 border text-left">Дата</th>
                  <th className="p-2 border text-left">Действие</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openOrder(o.id)}
>
                    <td className="p-2 border">{o.id}</td>
                    <td className="p-2 border">{o.user_id}</td>
                    <td className="p-2 border">
                    <div className="font-medium">{o.user_name}</div>
                    </td>
                    <td className="p-2 border text-sm">
                    {o.user_car || "—"}
                    </td>
                    <td className="p-2 border">
                    {PAYMENT_LABELS[o.payment_method] ?? o.payment_method}
                    </td>
                    <td className="p-2 border">{formatKZT(o.total_amount)}</td>
                    <td className="p-2 border">{o.discount_percent}%</td>
                    <td className="p-2 border font-semibold">{formatKZT(o.final_amount)}</td>
                    <td className="p-2 border">{new Date(o.created_at).toLocaleDateString("ru-RU")}</td>
                   <td className="p-2 border">
                    {o.status === "pending" ? (
                        <div className="flex gap-2">
                        <button
                            disabled={actionId === o.id}
                            onClick={() => onApprove(o.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
                        >
                            {actionId === o.id ? "..." : "Подтвердить"}
                        </button>

                        <button
                            disabled={actionId === o.id}
                            onClick={() => onReject(o.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                        >
                            {actionId === o.id ? "..." : "Отклонить"}
                        </button>
                        </div>
                    ) : (
                        <span className="text-xs text-gray-500">—</span>
                    )}
                    </td> 
                  </tr>
                ))}
                {pendingOrders.length === 0 && (
                  <tr>
                    <td className="p-3 border text-gray-500" colSpan={8}>
                      Нет ожидающих заказов
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

                <div className="mt-4 flex items-center justify-between">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded disabled:opacity-40"
                >
                    ← Назад
                </button>

                <div className="text-sm text-gray-600">
                    Страница {page}
                </div>

                    <button
                    disabled={page * limit >= totalOrders}
                    onClick={() => setPage(p => p + 1)}
                    className="border rounded px-4 py-2 disabled:opacity-50"
                    >
                    Вперёд →
                    </button>
                </div>
          </div>
        </section>

        {/* REPORTS */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Отчёты Excel</h2>

          <div className="mt-4 flex flex-wrap gap-3 items-end">
            <div>
              <div className="text-xs text-gray-500">Общий отчёт: дата от </div>
              <input
                type="date"
                className="border rounded px-2 py-2"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                />
            </div>

            <div>
              <div className="text-xs text-gray-500">дата до </div>
              <input
                type="date"
                className="border rounded px-2 py-2"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                />
            </div>

            <button
              disabled={loading}
              onClick={onDownloadOrdersExcel}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Скачать общий отчёт
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 items-end">
            <div>
              <div className="text-xs text-gray-500">Отчёт по клиенту: User ID</div>
              <input className="border rounded px-2 py-2 w-28" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </div>

            <div>
              <div className="text-xs text-gray-500">дата от </div>
              <input
                type="date"
                className="border rounded px-2 py-2"
                value={clientDateFrom}
                onChange={(e) => setClientDateFrom(e.target.value)}
                />
            </div>

            <div>
              <div className="text-xs text-gray-500">дата до </div>
              <input
                type="date"
                className="border rounded px-2 py-2"
                value={clientDateTo}
                onChange={(e) => setClientDateTo(e.target.value)}
                />
            </div>

            <button
              disabled={loading}
              onClick={onDownloadClientExcel}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Скачать отчёт по клиенту
            </button>
          </div>

        </section>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
            <div className="bg-white rounded-2xl border w-full max-w-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
                <div className="font-semibold">Заказ #{selectedId}</div>
                <button className="text-sm underline" onClick={() => setOpen(false)}>Закрыть</button>
            </div>

            {!details ? (
                <div className="mt-4 text-sm text-gray-500">Загрузка...</div>
            ) : (
                <>
                <div className="mt-3 text-sm">
                Клиент: <b>{details.user_name}</b> •{" "}
                Оплата: <b>{PAYMENT_LABELS[details.payment_method] ?? details.payment_method}</b> •{" "}
                Статус: <b>{STATUS_LABEL[details.status] ?? details.status}</b>
                </div>


                <div className="mt-3 overflow-auto">
                    <table className="w-full text-sm border">
                    <thead>
                        <tr className="bg-gray-100">
                        <th className="p-2 border text-left">Товар</th>
                        <th className="p-2 border text-left">Тип</th>
                        <th className="p-2 border text-left">Кол-во</th>
                        <th className="p-2 border text-left">Цена</th>
                        <th className="p-2 border text-left">Скидка</th>
                        <th className="p-2 border text-left">Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        {details.items.map((it: any) => (
                        <tr key={it.id}>
                            <td className="p-2 border">{it.product_name}</td>
                            <td className="p-2 border">{it.type?.name ?? "—"}</td>
                            <td className="p-2 border">{it.quantity}</td>
                            <td className="p-2 border">{it.original_price} → {it.price}</td>
                            <td className="p-2 border">{it.product_discount_percent}%</td>
                            <td className="p-2 border">{it.line_total}</td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>

                <div className="mt-3 text-sm">
                    Итого: <b>{details.total_amount}</b> • Скидка клиента: <b>{details.discount_percent}%</b> • К оплате: <b>{details.final_amount}</b>
                </div>
                </>
            )}
            </div>
        </div>
        )}




    </main>
  );
}
