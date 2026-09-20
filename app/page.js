'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

const LOW_STOCK = 5; // เกณฑ์สต็อกใกล้หมด (เท่ากับที่ใช้แจ้งเตือน Telegram)

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [todaySales, setTodaySales] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    const load = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [salesRes, stockRes] = await Promise.all([
        supabase
          .from('sales')
          .select('product_name, quantity, total_price, sold_at')
          .gte('sold_at', startOfDay.toISOString())
          .order('sold_at', { ascending: false }),
        supabase
          .from('products')
          .select('id, name, stock, unit')
          .lte('stock', LOW_STOCK)
          .order('stock', { ascending: true }),
      ]);

      const err = salesRes.error || stockRes.error;
      if (err) {
        setErrorMsg('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      } else {
        setTodaySales(salesRes.data || []);
        setLowStock(stockRes.data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const totalToday = todaySales.reduce((sum, s) => sum + Number(s.total_price), 0);
  const itemsToday = todaySales.reduce((sum, s) => sum + Number(s.quantity), 0);

  const statBox = { flex: '1 1 180px', textAlign: 'center' };
  const bigNumber = { fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primary-dark)' };

  return (
    <div>
      <h1 style={{ marginBottom: 16, color: 'var(--color-primary-dark)' }}>
        🐾 ยินดีต้อนรับสู่ Meow O shop
      </h1>

      {errorMsg && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--color-danger)', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}

      {/* สรุปยอดขายวันนี้ */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="card" style={statBox}>
          <div>ยอดขายวันนี้</div>
          <div style={bigNumber}>{loading ? '...' : totalToday.toFixed(2)} บาท</div>
        </div>
        <div className="card" style={statBox}>
          <div>สินค้าที่ขายได้วันนี้</div>
          <div style={bigNumber}>{loading ? '...' : itemsToday} ชิ้น</div>
        </div>
        <div className="card" style={statBox}>
          <div>จำนวนรายการขาย</div>
          <div style={bigNumber}>{loading ? '...' : todaySales.length} รายการ</div>
        </div>
      </div>

      {/* สินค้าใกล้หมด */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>🚨 สินค้าใกล้หมด (เหลือ {LOW_STOCK} ชิ้นหรือน้อยกว่า)</h2>
        {loading ? (
          <p>กำลังโหลดข้อมูล...</p>
        ) : lowStock.length === 0 ? (
          <p>ตอนนี้สต็อกทุกรายการยังเพียงพอ 🐱</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lowStock.map((p) => (
              <div
                key={p.id}
                style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-gray)', paddingBottom: 6 }}
              >
                <span>{p.name}</span>
                <strong style={{ color: p.stock <= 0 ? 'var(--color-danger)' : 'inherit' }}>
                  {p.stock <= 0 ? 'หมดแล้ว' : `เหลือ ${p.stock} ${p.unit || 'ชิ้น'}`}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ทางลัด */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/sell" className="btn btn-primary">🛒 ไปหน้าขายสินค้า</Link>
        <Link href="/history" className="btn btn-primary">📜 ดูประวัติการขาย</Link>
      </div>
    </div>
  );
}
