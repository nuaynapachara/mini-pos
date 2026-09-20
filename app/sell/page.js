"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// ===== ตั้งค่าชื่อตาราง/คอลัมน์ (ถ้าของ Week 8 ชื่อไม่ตรง แก้ตรงนี้ที่เดียว) =====
// ตาราง products ต้องมีคอลัมน์: id, name, price, stock
const PRODUCTS_TABLE = "products";
const SALES_TABLE = "sales";
const SALES_COLUMNS = {
  productId: "product_id",
  quantity: "quantity",
  totalPrice: "total_price",
};

// ===== ส่งแจ้งเตือน Telegram ผ่าน /api/telegram =====
// พังก็ไม่กระทบระบบขาย (ดัก error ไว้ทั้งหมด)
async function notifyTelegram(payload) {
  try {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) console.warn("Telegram notify not ok:", data.reason ?? "");
  } catch (err) {
    console.error("Telegram notify error:", err);
  }
}

const LOW_STOCK_THRESHOLD = 5;

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState("1");
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error" | "warn", text }

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setMessage({ type: "error", text: "โหลดสินค้าไม่สำเร็จ: " + error.message });
    } else {
      setProducts(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const selected = products.find((p) => String(p.id) === String(selectedId));
  const amount = parseInt(qty, 10);
  const previewTotal =
    selected && Number.isInteger(amount) && amount > 0
      ? Number(selected.price) * amount
      : 0;

  const handleSell = async () => {
    setMessage(null);

    if (!selected) {
      setMessage({ type: "error", text: "กรุณาเลือกสินค้า" });
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage({ type: "error", text: "จำนวนต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป" });
      return;
    }
    if (amount > selected.stock) {
      setMessage({
        type: "error",
        text: `สต๊อกไม่พอ (เหลือ ${selected.stock} ชิ้น)`,
      });
      return;
    }

    setSelling(true);
    try {
      const stockAfter = selected.stock - amount;
      const totalPrice = Number(selected.price) * amount;

      // ตัดสต๊อก (เช็ค stock เดิมด้วย กันขายซ้อนกันจนสต๊อกติดลบ)
      const { data: updated, error: updateError } = await supabase
        .from(PRODUCTS_TABLE)
        .update({ stock: stockAfter })
        .eq("id", selected.id)
        .eq("stock", selected.stock)
        .select();

      if (updateError) {
        setMessage({ type: "error", text: "ตัดสต๊อกไม่สำเร็จ: " + updateError.message });
        return;
      }
      if (!updated || updated.length === 0) {
        setMessage({
          type: "error",
          text: "สต๊อกมีการเปลี่ยนแปลง กรุณาลองขายอีกครั้ง",
        });
        await loadProducts();
        return;
      }

      // บันทึกประวัติการขาย
      const { error: saleError } = await supabase.from(SALES_TABLE).insert({
        [SALES_COLUMNS.productId]: selected.id,
        [SALES_COLUMNS.quantity]: amount,
        [SALES_COLUMNS.totalPrice]: totalPrice,
      });

      // ตัดสต๊อกสำเร็จแล้ว → แจ้งเตือน Telegram (ไม่ await เพื่อไม่ให้หน้าเว็บช้า)
      notifyTelegram({
        productName: selected.name,
        qty: amount,
        totalPrice,
        stockAfter,
      });

      if (saleError) {
        setMessage({
          type: "warn",
          text: `ตัดสต๊อกแล้ว แต่บันทึกประวัติไม่สำเร็จ: ${saleError.message}`,
        });
      } else {
        setMessage({
          type: "success",
          text: `ขายสำเร็จ: ${selected.name} ${amount} ชิ้น รวม ${totalPrice.toLocaleString("th-TH")} บาท`,
        });
      }

      setQty("1");
      await loadProducts();
    } finally {
      setSelling(false);
    }
  };

  const messageColors = {
    success: { bg: "#e8f5e9", fg: "#1b5e20" },
    error: { bg: "#ffebee", fg: "#b71c1c" },
    warn: { bg: "#fff8e1", fg: "#7a5200" },
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>ขายสินค้า</h1>

      {loading ? (
        <p>กำลังโหลดสินค้า...</p>
      ) : products.length === 0 ? (
        <p>ยังไม่มีสินค้าในระบบ เพิ่มสินค้าที่หน้ารายการสินค้าก่อน</p>
      ) : (
        <section style={styles.card}>
          <label style={styles.label} htmlFor="product">
            สินค้า
          </label>
          <select
            id="product"
            style={styles.input}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">-- เลือกสินค้า --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                {p.name} — {Number(p.price).toLocaleString("th-TH")} บาท (เหลือ {p.stock})
                {p.stock <= 0 ? " หมด" : ""}
              </option>
            ))}
          </select>

          {selected && (
            <p
              style={{
                ...styles.hint,
                color: selected.stock <= LOW_STOCK_THRESHOLD ? "#b71c1c" : "#555",
              }}
            >
              สต๊อกคงเหลือ {selected.stock} ชิ้น
              {selected.stock <= LOW_STOCK_THRESHOLD ? " (ใกล้หมด)" : ""}
            </p>
          )}

          <label style={styles.label} htmlFor="qty">
            จำนวน
          </label>
          <input
            id="qty"
            type="number"
            min="1"
            inputMode="numeric"
            style={styles.input}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />

          <p style={styles.total}>
            ราคารวม {previewTotal.toLocaleString("th-TH")} บาท
          </p>

          <button
            type="button"
            style={{ ...styles.button, opacity: selling ? 0.6 : 1 }}
            onClick={handleSell}
            disabled={selling}
          >
            {selling ? "กำลังบันทึก..." : "ขายสินค้า"}
          </button>
        </section>
      )}

      {message && (
        <p
          role="status"
          style={{
            ...styles.message,
            background: messageColors[message.type].bg,
            color: messageColors[message.type].fg,
          }}
        >
          {message.text}
        </p>
      )}
    </main>
  );
}

const styles = {
  page: { maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" },
  title: { fontSize: 24, marginBottom: 16 },
  card: { display: "flex", flexDirection: "column", gap: 8, padding: 16, border: "1px solid #ddd", borderRadius: 12 },
  label: { fontSize: 14, fontWeight: 600, marginTop: 8 },
  input: { padding: "10px 12px", fontSize: 16, border: "1px solid #ccc", borderRadius: 8 },
  hint: { fontSize: 14, margin: 0 },
  total: { fontSize: 18, fontWeight: 700, margin: "12px 0 4px" },
  button: { padding: "12px 16px", fontSize: 16, fontWeight: 600, color: "#fff", background: "#1a73e8", border: "none", borderRadius: 8, cursor: "pointer" },
  message: { marginTop: 16, padding: "12px 14px", borderRadius: 8, fontSize: 15 },
};
