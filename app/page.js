'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ค่าเริ่มต้นของฟอร์มเพิ่มสินค้าใหม่
const emptyForm = { sku: '', name: '', price: '', stock: '', unit: '', image_url: '' };

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // สถานะแก้ไขแบบ inline: เก็บ id แถวที่กำลังแก้ไข + ข้อมูลชั่วคราว
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // โหลดรายการสินค้าทั้งหมด เรียงตามวันที่สร้างล่าสุด
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

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

  // จัดการค่าฟอร์มเพิ่มสินค้าใหม่
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // เพิ่มสินค้าใหม่ลง Supabase
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price) {
      setErrorMsg('กรุณากรอก SKU, ชื่อสินค้า และราคาให้ครบ');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        unit: form.unit,
        image_url: form.image_url,
      },
    ]);

    if (error) {
      setErrorMsg('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setForm(emptyForm);
      setErrorMsg('');
      fetchProducts();
    }
    setSaving(false);
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    if (!confirm('ยืนยันการลบสินค้านี้หรือไม่?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setErrorMsg('ลบสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  // เริ่มแก้ไขแถว: คัดลอกข้อมูลแถวนั้นมาไว้ใน editForm
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku || '',
      name: product.name || '',
      price: product.price ?? '',
      stock: product.stock ?? '',
      unit: product.unit || '',
      image_url: product.image_url || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // บันทึกการแก้ไขสินค้ากลับไปที่ Supabase
  const saveEdit = async (id) => {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock) || 0,
        unit: editForm.unit,
        image_url: editForm.image_url,
      })
      .eq('id', id);

    if (error) {
      setErrorMsg('บันทึกการแก้ไขไม่สำเร็จ: ' + error.message);
    } else {
      setEditingId(null);
      fetchProducts();
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16, color: 'var(--color-primary-dark)' }}>
        🐾 รายการสินค้า Meow O shop
      </h1>

      {errorMsg && (
        <div
          className="card"
          style={{ marginBottom: 16, color: 'var(--color-danger)', fontWeight: 600 }}
        >
          {errorMsg}
        </div>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <form
        onSubmit={handleAddProduct}
        className="card"
        style={{
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label>SKU</label>
          <input name="sku" value={form.sku} onChange={handleFormChange} placeholder="เช่น CAT001" />
        </div>
        <div>
          <label>ชื่อสินค้า</label>
          <input name="name" value={form.name} onChange={handleFormChange} placeholder="ชื่อสินค้า" />
        </div>
        <div>
          <label>ราคา</label>
          <input name="price" type="number" step="0.01" value={form.price} onChange={handleFormChange} placeholder="0.00" />
        </div>
        <div>
          <label>คงเหลือ</label>
          <input name="stock" type="number" value={form.stock} onChange={handleFormChange} placeholder="0" />
        </div>
        <div>
          <label>หน่วย</label>
          <input name="unit" value={form.unit} onChange={handleFormChange} placeholder="เช่น ถุง, ชิ้น" />
        </div>
        <div>
          <label>ลิงก์รูปภาพ</label>
          <input name="image_url" value={form.image_url} onChange={handleFormChange} placeholder="https://..." />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'กำลังบันทึก...' : '+ เพิ่มสินค้า'}
        </button>
      </form>

      {/* ตารางรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>รูปภาพ</th>
                <th>ชื่อสินค้า</th>
                <th>ราคา</th>
                <th>คงเหลือ</th>
                <th>หน่วย</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>
                    ยังไม่มีสินค้าในระบบ 🐱
                  </td>
                </tr>
              )}

              {products.map((p) =>
                editingId === p.id ? (
                  // --- แถวโหมดแก้ไข (inline) ---
                  <tr key={p.id}>
                    <td><input name="sku" value={editForm.sku} onChange={handleEditChange} /></td>
                    <td><input name="image_url" value={editForm.image_url} onChange={handleEditChange} /></td>
                    <td><input name="name" value={editForm.name} onChange={handleEditChange} /></td>
                    <td><input name="price" type="number" step="0.01" value={editForm.price} onChange={handleEditChange} /></td>
                    <td><input name="stock" type="number" value={editForm.stock} onChange={handleEditChange} /></td>
                    <td><input name="unit" value={editForm.unit} onChange={handleEditChange} /></td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={() => saveEdit(p.id)}>บันทึก</button>
                      <button className="btn" onClick={cancelEdit}>ยกเลิก</button>
                    </td>
                  </tr>
                ) : (
                  // --- แถวโหมดแสดงผลปกติ ---
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ) : (
                        '🐾'
                      )}
                    </td>
                    <td>{p.name}</td>
                    <td>{Number(p.price).toFixed(2)} บาท</td>
                    <td>{p.stock}</td>
                    <td>{p.unit}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={() => startEdit(p)}>แก้ไข</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(p.id)}>ลบ</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
