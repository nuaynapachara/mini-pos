'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // โหลดประวัติการขายทั้งหมด เรียงจากล่าสุดไปเก่าสุด
  const fetchSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      setErrorMsg('โหลดประวัติการขายไม่สำเร็จ: ' + error.message);
    } else {
      setSales(data || []);
      setErrorMsg('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // สรุปยอดขายรวมทั้งหมดจากทุกรายการ
  const totalSalesAmount = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  // แปลงเวลาให้อ่านง่ายในรูปแบบไทย
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16, color: 'var(--color-primary-dark)' }}>
        📜 ประวัติการขาย Meow O shop
      </h1>

      {errorMsg && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--color-danger)', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}

      {/* สรุปยอดขายรวม */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>🧾 จำนวนรายการขายทั้งหมด: {sales.length} รายการ</span>
        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
          ยอดขายรวม: {totalSalesAmount.toFixed(2)} บาท
        </span>
      </div>

      {/* ตารางประวัติการขาย */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>ชื่อสินค้า</th>
                <th>จำนวนที่ขาย</th>
                <th>ราคารวม</th>
                <th>เวลาที่ขาย</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>
                    ยังไม่มีประวัติการขาย 🐱
                  </td>
                </tr>
              )}

              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{s.product_name}</td>
                  <td>{s.quantity}</td>
                  <td>{Number(s.total_price).toFixed(2)} บาท</td>
                  <td>{formatDateTime(s.sold_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
