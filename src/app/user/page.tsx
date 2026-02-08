"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder, getMyOrders, getProducts, logout, getToken, getMe } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  price: number;
  discount_percent: number; // у товара (доп. скидка/акция), если ты используешь
  active: boolean;
};

type OrderOut = {
  id: number;
  total_amount: number;
  discount_percent: number;
  final_amount: number;
  payment_method: string;
  status: string;
  created_at: string; 
  user_order_number: number;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Me = {
  id: number;
  phone: string;
  name: string;
  car_brand: string;
  orders_count: number;
  discount: number;
  is_admin: boolean;
};

function formatKZT(v: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₸";
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  bank: "Банк / перевод",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "На подтверждении",
  approved: "Подтверждён",
  rejected: "Отклонён",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-600",
  approved: "text-green-600",
  rejected: "text-red-600",
};


export default function UserPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  type Tab = "home" | "products" | "cart" | "history";
  const [tab, setTab] = useState<Tab>("home");
  const [me, setMe] = useState<Me | null>(null);
  const [justAdded, setJustAdded] = useState<Record<number, boolean>>({});
  

async function loadAll() {
  setMsg(null);

  // 1) если токена нет — сразу на логин
  const token = getToken();
  if (!token) {
    router.replace("/");
    return;
  }

  try {
    const [m, p, o] = await Promise.all([getMe(), getProducts(), getMyOrders()]);
    setMe(m);
    setProducts(p);
    setOrders(o);

    // 2) если админ случайно зашёл в user — кидаем в /admin
    if (m.is_admin) {
      router.replace("/admin");
    }
  } catch (e: any) {
    setMsg("❌ " + e.message + " (возможно, ты не авторизован — зайди на /)");
  }
}


  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => p.name.toLowerCase().includes(s));
  }, [products, q]);

  const cartList = useMemo(() => Object.values(cart), [cart]);

const userDiscount = me?.discount ?? 0;

const subtotalOriginal = useMemo(() => {
  return cartList.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
}, [cartList]);

const subtotalAfterProductDiscount = useMemo(() => {
  return cartList.reduce((sum, it) => {
    const unit = getProductFinalPrice(it.product); // цена после скидки товара
    return sum + unit * it.quantity;
  }, 0);
}, [cartList]);

const productDiscountAmount = useMemo(() => {
  return subtotalOriginal - subtotalAfterProductDiscount;
}, [subtotalOriginal, subtotalAfterProductDiscount]);

const finalEstimated = useMemo(() => {
  // скидка клиента применяется ПОСЛЕ скидок товаров
  return applyPercent(subtotalAfterProductDiscount, userDiscount);
}, [subtotalAfterProductDiscount, userDiscount]);

const userDiscountAmount = useMemo(() => {
  return subtotalAfterProductDiscount - finalEstimated;
}, [subtotalAfterProductDiscount, finalEstimated]);


function addToCart(p: Product) {
  setCart((prev) => {
    const cur = prev[p.id];
    const nextQty = cur ? cur.quantity + 1 : 1;
    return { ...prev, [p.id]: { product: p, quantity: nextQty } };
  });

  setJustAdded((prev) => ({ ...prev, [p.id]: true }));
  window.setTimeout(() => {
    setJustAdded((prev) => {
      const copy = { ...prev };
      delete copy[p.id];
      return copy;
    });
  }, 1000);
}

  function onLogout() {
    logout();
    router.replace("/");
  }

  function inc(id: number) {
    setCart((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, quantity: cur.quantity + 1 } };
    });
  }

  function dec(id: number) {
    setCart((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const nextQty = cur.quantity - 1;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: { ...cur, quantity: nextQty } };
    });
  }

  function clearCart() {
    setCart({});
  }

  async function submitOrder() {
    setMsg(null);
    const items = cartList.map((it) => ({
      product_id: it.product.id,
      quantity: it.quantity,
    }));
    if (items.length === 0) {
      setMsg("⚠️ Корзина пустая");
      return;
    }

    setLoading(true);
    try {
      const created = await createOrder({
        items,
        payment_method: paymentMethod,
      });

      setMsg("✅ Заказ создан и отправлен на подтверждение админом");
      clearCart();

      // обновим историю
      await loadAll();
      setTab("history");

      // Если хочешь — можно показать детали created (final_amount и скидку)
      // console.log(created);
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

function applyPercent(price: number, percent: number) {
  return Math.round(price * (1 - percent / 100));
}

function getProductFinalPrice(p: Product) {
  const dp = p.discount_percent ?? 0; // скидка товара
  return applyPercent(p.price, dp);
}

  return (
  <main className="min-h-screen bg-gray-50 pb-20">
    {/* Top bar */}
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <div className="font-semibold">
            {tab === "home" && "Главная"}
            {tab === "products" && "Товары"}
            {tab === "cart" && "Корзина"}
            {tab === "history" && "История"}
          </div>
          <div className="text-xs text-gray-500">
            {tab === "home" && "Ваша скидка и статус"}
            {tab === "products" && "Выберите товары и добавьте в корзину"}
            {tab === "cart" && "Проверьте корзину и отправьте заказ"}
            {tab === "history" && "Ваши заказы и статусы"}
          </div>
        </div>

        <button
          onClick={onLogout}
          className="ml-auto rounded-xl border px-3 py-2 text-sm"
        >
          Выйти
        </button>
      </div>

      {/* Search only on Products */}
      {tab === "products" && (
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <input
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="Поиск товара..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
    </div>

    <div className="max-w-3xl mx-auto px-4 py-4 grid gap-4">
      {msg && (
        <div className="rounded-xl border bg-white p-3 text-sm">
          {msg}
        </div>
      )}

      {/* HOME TAB */}
      {tab === "home" && (
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Ваша скидка</h2>


          <div className="mt-4 rounded-2xl border p-5">
          <div className="text-sm text-gray-600 mb-2">
            Текущая скидка
          </div>

          <div className="flex items-center justify-between">
            <div className="text-6xl font-extrabold leading-none">
              {me ? `${me.discount}%` : "—"}
            </div>

            <button
              onClick={loadAll}
              className="rounded-xl bg-black text-white px-4 py-2 text-sm"
            >
              Обновить
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Заказов подтверждено: {me?.orders_count ?? 0}
          </div>
        </div>


          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Товаров доступно</span>
              <span className="font-medium">{products.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Заказов в истории</span>
              <span className="font-medium">{orders.length}</span>
            </div>
          </div>
        </section>
      )}

      {/* PRODUCTS TAB */}
      {tab === "products" && (
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-end">
            <div className="text-xs text-gray-500">{filtered.length} шт.</div>
          </div>


          <div className="mt-3 grid gap-2">
           {filtered.map((p) => {
            const inCartQty = cart[p.id]?.quantity ?? 0;
            const inCart = inCartQty > 0;
            const addedFlash = !!justAdded[p.id];

            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  addedFlash ? "ring-2 ring-black" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-sm text-gray-600">
                    {p.discount_percent > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="line-through text-gray-400">{formatKZT(p.price)}</span>
                        <span className="font-semibold">{formatKZT(getProductFinalPrice(p))}</span>
                        <span className="text-xs rounded-full border px-2 py-0.5">
                          -{p.discount_percent}%
                        </span>
                      </div>
                    ) : (
                      <span>{formatKZT(p.price)}</span>
                    )}
                  </div>
                </div>

                <button
                  disabled={inCart}
                  onClick={() => addToCart(p)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    inCart ? "bg-black text-white opacity-90 cursor-default" : "bg-white"
                  }`}
                >
                  {inCart ? `Добавлено (${inCartQty})` : "+ Добавить"}
                </button>
              </div>
            );
          })}
          </div>
        </section>
      )}

      {/* CART TAB */}
      {tab === "cart" && (
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-end">
            <button className="text-xs underline text-gray-600" onClick={clearCart}>
              Очистить
            </button>
          </div>

          {cartList.length === 0 ? (
            <div className="mt-3 text-sm text-gray-500">Пока пусто</div>
          ) : (
            <div className="mt-3 grid gap-2">
              {cartList.map((it) => (
                <div key={it.product.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{it.product.name}</div>
                    <div className="text-sm text-gray-600">
                      {it.product.discount_percent > 0 ? (
                        <div className="text-sm text-gray-600">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="line-through text-gray-400">
                              {formatKZT(it.product.price)}
                            </span>
                            <span className="font-medium">
                              {formatKZT(getProductFinalPrice(it.product))}
                            </span>
                            <span className="text-xs rounded-full border px-2 py-0.5">
                              -{it.product.discount_percent}%
                            </span>
                          </div>

                          <div className="mt-1">
                            {formatKZT(getProductFinalPrice(it.product))} × {it.quantity} ={" "}
                            {formatKZT(getProductFinalPrice(it.product) * it.quantity)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          {formatKZT(it.product.price)} × {it.quantity} ={" "}
                          {formatKZT(it.product.price * it.quantity)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border px-3 py-2" onClick={() => dec(it.product.id)}>
                      −
                    </button>
                    <div className="w-8 text-center text-sm">{it.quantity}</div>
                    <button className="rounded-lg border px-3 py-2" onClick={() => inc(it.product.id)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-2">
             <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Сумма (без скидок)</span>
              <span className="font-medium">{formatKZT(subtotalOriginal)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Скидка товаров</span>
              <span className="font-medium">
                {productDiscountAmount > 0 ? `- ${formatKZT(productDiscountAmount)}` : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Сумма после скидок товаров</span>
              <span className="font-medium">{formatKZT(subtotalAfterProductDiscount)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Скидка клиента</span>
              <span className="font-medium">
                {me ? `${me.discount}% (- ${formatKZT(userDiscountAmount)})` : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Итого (примерно)</span>
              <span className="font-semibold">{formatKZT(finalEstimated)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Способ оплаты</span>
              <div className="flex gap-2">
                <button
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    paymentMethod === "cash" ? "bg-black text-white" : "bg-white"
                  }`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  Наличные
                </button>
                <button
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    paymentMethod === "bank" ? "bg-black text-white" : "bg-white"
                  }`}
                  onClick={() => setPaymentMethod("bank")}
                >
                  Банк/перевод
                </button>
              </div>
            </div>

            <button
              disabled={loading || cartList.length === 0}
              onClick={submitOrder}
              className="mt-2 w-full rounded-xl bg-black text-white p-3 disabled:opacity-50"
            >
              {loading ? "Отправляем..." : "Купить / Отправить заказ"}
            </button>
          </div>
        </section>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-end">
            <button className="text-xs underline text-gray-600" onClick={loadAll}>
              Обновить
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {orders.length === 0 ? (
              <div className="text-sm text-gray-500">Заказов пока нет</div>
            ) : (
              orders.slice().reverse().map((o) => (
                <div key={o.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Заказ #{o.user_order_number}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(o.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    Сумма: {formatKZT(o.total_amount)} • Скидка: {o.discount_percent}% • К оплате:{" "}
                    <span className="font-semibold">{formatKZT(o.final_amount)}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Оплата: {PAYMENT_LABELS[o.payment_method] ?? o.payment_method}
                    {" • "}
                    Статус:{" "}
                    <span className={STATUS_COLOR[o.status] ?? "text-gray-500"}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>

    {/* Bottom Tabs */}
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white">
      <div className="max-w-3xl mx-auto px-4 py-2 grid grid-cols-4 gap-2 text-xs">
        <button
          onClick={() => setTab("home")}
          className={`rounded-xl px-2 py-2 border ${tab === "home" ? "bg-black text-white" : ""}`}
        >
          Главная
        </button>
        <button
          onClick={() => setTab("products")}
          className={`rounded-xl px-2 py-2 border ${tab === "products" ? "bg-black text-white" : ""}`}
        >
          Товары
        </button>
        <button
          onClick={() => setTab("cart")}
          className={`rounded-xl px-2 py-2 border ${tab === "cart" ? "bg-black text-white" : ""}`}
        >
          Корзина ({cartList.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`rounded-xl px-2 py-2 border ${tab === "history" ? "bg-black text-white" : ""}`}
        >
          История
        </button>
      </div>
    </nav>
  </main>
);
}
