'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
// ส่งข้อมูลการขายไปที่ API Route ให้เซิร์ฟเวอร์ยิง Telegram
async function notifySale({ name, qty, total, stockAfter }) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, qty, total, stockAfter }),
      keepalive: true,
    });
  } catch (err) {
    console.error('[Telegram] แจ้งเตือนไม่สำเร็จ:', err);
  }
}


export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ตะกร้าสินค้า: เก็บเป็น object { [product_id]: { product, quantity } }
  const [cart, setCart] = useState({});
  const [checkingOut, setCheckingOut] = useState(false);

  // โหลดรายการสินค้าทั้งหมด
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data || []);
      setErrorMsg('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // เพิ่มสินค้าลงตะกร้า (หรือเพิ่มจำนวนถ้ามีอยู่แล้ว)
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev[product.id];
      const currentQty = existing ? existing.quantity : 0;

      // กันไม่ให้เพิ่มเกินสต็อกที่มี
      if (currentQty + 1 > product.stock) {
        setErrorMsg(`สินค้า "${product.name}" มีคงเหลือไม่พอ (คงเหลือ ${product.stock} ${product.unit || ''})`);
        return prev;
      }
      setErrorMsg('');
      return {
        ...prev,
        [product.id]: { product, quantity: currentQty + 1 },
      };
    });
  };

  // ปรับจำนวนสินค้าในตะกร้าโดยตรง
  const updateQuantity = (productId, qty) => {
    const item = cart[productId];
    if (!item) return;

    const newQty = Math.max(0, Number(qty) || 0);

    if (newQty > item.product.stock) {
      setErrorMsg(`สินค้า "${item.product.name}" มีคงเหลือไม่พอ (คงเหลือ ${item.product.stock} ${item.product.unit || ''})`);
      return;
    }
    setErrorMsg('');

    if (newQty === 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) => ({
      ...prev,
      [productId]: { ...item, quantity: newQty },
    }));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // คำนวณยอดรวมทั้งตะกร้า
  const cartItems = Object.values(cart);
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  // ยืนยันการขาย: บันทึกลง sales ทีละรายการ + ตัดสต็อกใน products
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('กรุณาเลือกสินค้าก่อนทำการขาย');
      return;
    }

    setCheckingOut(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      for (const item of cartItems) {
        const { product, quantity } = item;
        const itemTotal = Number(product.price) * quantity;

        // 1) บันทึกรายการขายลงตาราง sales
        const { error: saleError } = await supabase.from('sales').insert([
          {
            product_id: product.id,
            product_name: product.name,
            quantity: quantity,
            total_price: itemTotal,
            sold_at: new Date().toISOString(),
          },
        ]);
        if (saleError) throw saleError;

        // 2) ตัดสต็อกสินค้าในตาราง products
        const newStock = product.stock - quantity;
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', product.id);
        if (stockError) throw stockError;

        // 3) ➕ แจ้งเตือน Telegram หลังตัดสต็อกสำเร็จ
        // ไม่ใช้ await เพื่อไม่ให้หน้าขายช้า/ค้าง และ .catch กันไว้อีกชั้น
        // (notifySale มี try/catch ภายในอยู่แล้ว จึงไม่กระทบการขายแน่นอน)
        notifySale({
          name: product.name,
          qty: quantity,
          total: itemTotal,
          stockAfter: newStock,
        }).catch((err) => console.error('[Telegram] แจ้งเตือนไม่สำเร็จ:', err));
      }

      setSuccessMsg('บันทึกการขายเรียบร้อยแล้ว 🐾');
      setCart({});
      fetchProducts(); // โหลดสต็อกล่าสุดใหม่
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดระหว่างบันทึกการขาย: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16, color: 'var(--color-primary-dark)' }}>
        🛒 ขายสินค้า Meow O shop
      </h1>

      {errorMsg && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--color-danger)', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--color-primary-dark)', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* รายการสินค้าให้เลือกซื้อ */}
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>รายการสินค้า</h2>
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {products.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                    />
                  )}
                  <strong>{p.name}</strong>
                  <span>{Number(p.price).toFixed(2)} บาท / {p.unit || 'ชิ้น'}</span>
                  <span style={{ fontSize: '0.85rem', color: p.stock > 0 ? '#5A3E36' : 'var(--color-danger)' }}>
                    คงเหลือ: {p.stock}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                  >
                    {p.stock <= 0 ? 'สินค้าหมด' : '+ เพิ่มลงตะกร้า'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ตะกร้าสินค้า / สรุปยอดขาย */}
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>ตะกร้าสินค้า</h2>
          {cartItems.length === 0 ? (
            <p>ยังไม่มีสินค้าในตะกร้า 🐱</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cartItems.map(({ product, quantity }) => (
                <div key={product.id} style={{ borderBottom: '1px solid var(--color-gray)', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>{product.name}</span>
                    <button className="btn btn-danger" onClick={() => removeFromCart(product.id)}>ลบ</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min="1"
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => updateQuantity(product.id, e.target.value)}
                      style={{ width: 70 }}
                    />
                    <span>x {Number(product.price).toFixed(2)} บาท</span>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>
                    รวม: {(Number(product.price) * quantity).toFixed(2)} บาท
                  </div>
                </div>
              ))}

              <div style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'right' }}>
                ยอดรวมทั้งหมด: {totalAmount.toFixed(2)} บาท
              </div>

              <button
                className="btn btn-primary"
                onClick={handleCheckout}
                disabled={checkingOut}
                style={{ width: '100%' }}
              >
                {checkingOut ? 'กำลังบันทึก...' : '✅ ยืนยันการขาย'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
