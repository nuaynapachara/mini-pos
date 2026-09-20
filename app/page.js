'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  // State สำหรับข้อมูลสินค้าและยอดขาย
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  
  // State สำหรับฟอร์มเพิ่มสินค้าใหม่
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
    image_url: ''
  })

  // State สำหรับการแก้ไขสินค้า (เก็บ ID ของสินค้าที่กำลังแก้ และข้อมูลใหม่)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // โหลดข้อมูลเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchProducts()
    fetchSales()
  }, [])

  // ฟังก์ชันดึงข้อมูลสินค้าจาก Supabase
  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) console.error('Error fetching products:', error)
    else setProducts(data || [])
  }

  // ฟังก์ชันดึงข้อมูลการขายจาก Supabase มาคำนวณ Dashboard
  async function fetchSales() {
    const { data, error } = await supabase.from('sales').select('*')
    if (error) console.error('Error fetching sales:', error)
    else setSales(data || [])
  }

  // คำนวณสถิติต่างๆ สำหรับ Dashboard ด้านบน
  const totalRevenue = sales.reduce((sum, item) => sum + Number(item.total_price || 0), 0)
  const totalItemsSold = sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const totalTransactions = sales.length

  // กรองสินค้าที่ใกล้หมด (stock <= 5)
  const lowStockProducts = products.filter(p => p.stock <= 5)

  // ฟังก์ชันเพิ่มสินค้าใหม่
  async function handleAddProduct(e) {
    e.preventDefault()
    if (!newProduct.sku || !newProduct.name || !newProduct.price) {
      alert('กรุณากรอกข้อมูล SKU, ชื่อสินค้า และราคาให้ครบถ้วน')
      return
    }

    const { error } = await supabase.from('products').insert([
      {
        sku: newProduct.sku,
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock) || 0,
        unit: newProduct.unit,
        image_url: newProduct.image_url
      }
    ])

    if (error) {
      alert('เกิดข้อผิดพลาดในการเพิ่มสินค้า: ' + error.message)
    } else {
      setNewProduct({ sku: '', name: '', price: '', stock: '', unit: '', image_url: '' })
      fetchProducts()
    }
  }

  // ฟังก์ชันลบสินค้า
  async function handleDelete(id) {
    if (!confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert('Error deleting: ' + error.message)
    else fetchProducts()
  }

  // เริ่มต้นโหมดแก้ไข
  function startEdit(product) {
    setEditingId(product.id)
    setEditForm(product)
  }

  // บันทึกการแก้ไขสินค้า
  async function saveEdit(id) {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock),
        unit: editForm.unit,
        image_url: editForm.image_url
      })
      .eq('id', id)

    if (error) {
      alert('Error updating: ' + error.message)
    } else {
      setEditingId(null)
      fetchProducts()
    }
  }

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>🐾 ยินดีต้อนรับสู่ Meow O shop 🐾</h1>

      {/* --- ส่วนที่ 1: Dashboard สรุปสถิติร้านค้า --- */}
      <section style={styles.dashboardSection}>
        <div style={styles.cardGrid}>
          <div style={styles.card}>
            <p style={styles.cardTitle}>ยอดขายรวมทั้งหมด</p>
            <p style={styles.cardValue}>{totalRevenue.toLocaleString()} บาท</p>
          </div>
          <div style={styles.card}>
            <p style={styles.cardTitle}>สินค้าที่ขายได้ทั้งหมด</p>
            <p style={styles.cardValue}>{totalItemsSold} ชิ้น</p>
          </div>
          <div style={styles.card}>
            <p style={styles.cardTitle}>จำนวนรายการขาย</p>
            <p style={styles.cardValue}>{totalTransactions} รายการ</p>
          </div>
        </div>

        {/* กล่องแจ้งเตือนสินค้าใกล้หมด */}
        <div style={styles.alertBox}>
          <h3 style={styles.alertTitle}>🚨 สินค้าใกล้หมด (เหลือ 5 ชิ้นหรือน้อยกว่า)</h3>
          {lowStockProducts.length === 0 ? (
            <p style={styles.alertText}>ตอนนี้สต็อกทุกรายการยังเพียงพอ 🐱</p>
          ) : (
            <ul style={styles.alertList}>
              {lowStockProducts.map(p => (
                <li key={p.id} style={styles.alertItem}>
                  {p.name} (SKU: {p.sku}) - เหลือเพียง <strong>{p.stock}</strong> {p.unit}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <hr style={styles.divider} />

      {/* --- ส่วนที่ 2: ฟอร์มและตารางจัดการสินค้า (CRUD) --- */}
      <section style={styles.crudSection}>
        <h2 style={styles.subTitle}>📦 จัดการรายการสินค้า Meow O shop</h2>

        {/* ฟอร์มเพิ่มสินค้า */}
        <form onSubmit={handleAddProduct} style={styles.form}>
          <h3 style={styles.formTitle}>➕ เพิ่มสินค้าใหม่</h3>
          <div style={styles.formGrid}>
            <input
              type="text"
              placeholder="SKU (เช่น CAT-001)"
              value={newProduct.sku}
              onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="ชื่อสินค้า"
              value={newProduct.name}
              onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
              style={styles.input}
            />
            <input
              type="number"
              step="any"
              placeholder="ราคา (บาท)"
              value={newProduct.price}
              onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
              style={styles.input}
            />
            <input
              type="number"
              placeholder="จำนวนสต็อก"
              value={newProduct.stock}
              onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="หน่วย (เช่น ชิ้น, ถุง, แพ็ค)"
              value={newProduct.unit}
              onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="ลิงก์รูปภาพ (URL)"
              value={newProduct.image_url}
              onChange={e => setNewProduct({ ...newProduct, image_url: e.target.value })}
              style={styles.input}
            />
          </div>
          <button type="submit" style={styles.addButton}>+ เพิ่มสินค้า</button>
        </form>

        {/* ตารางแสดงรายการสินค้า */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>รูปภาพ</th>
                <th style={styles.th}>ชื่อสินค้า</th>
                <th style={styles.th}>ราคา</th>
                <th style={styles.th}>คงเหลือ</th>
                <th style={styles.th}>หน่วย</th>
                <th style={styles.th}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} style={styles.tableRow}>
                  {editingId === product.id ? (
                    <>
                      <td style={styles.td}><input value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} style={styles.editInput}/></td>
                      <td style={styles.td}><input value={editForm.image_url || ''} onChange={e => setEditForm({...editForm, image_url: e.target.value})} style={styles.editInput}/></td>
                      <td style={styles.td}><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={styles.editInput}/></td>
                      <td style={styles.td}><input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} style={styles.editInput}/></td>
                      <td style={styles.td}><input type="number" value={editForm.stock} onChange={e => setEditForm({...editForm, stock: e.target.value})} style={styles.editInput}/></td>
                      <td style={styles.td}><input value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} style={styles.editInput}/></td>
                      <td style={styles.td}>
                        <button onClick={() => saveEdit(product.id)} style={styles.saveBtn}>บันทึก</button>
                        <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>ยกเลิก</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={styles.td}>{product.sku}</td>
                      <td style={styles.td}>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} style={styles.productImg} />
                        ) : (
                          <span>ไม่มีรูป</span>
                        )}
                      </td>
                      <td style={styles.td}>{product.name}</td>
                      <td style={styles.td}>{Number(product.price).toFixed(2)} บาท</td>
                      <td style={styles.td}>{product.stock}</td>
                      <td style={styles.td}>{product.unit}</td>
                      <td style={styles.td}>
                        <button onClick={() => startEdit(product)} style={styles.editBtn}>แก้ไข</button>
                        <button onClick={() => handleDelete(product.id)} style={styles.deleteBtn}>ลบ</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

// 🎨 สไตล์การตกแต่งโทนอบอุ่น สไตล์ทาสแมว
const styles = {
  container: { padding: '20px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif', color: '#4A3525', backgroundColor: '#FFFDF9', minHeight: '100vh' },
  title: { textAlign: 'center', color: '#D97706', marginBottom: '20px' },
  subTitle: { color: '#B45309', marginBottom: '15px' },
  dashboardSection: { marginBottom: '30px' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' },
  card: { backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  cardTitle: { fontSize: '14px', color: '#92400E', margin: '0 0 8px 0' },
  cardValue: { fontSize: '22px', fontWeight: 'bold', color: '#B45309', margin: 0 },
  alertBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '15px', borderRadius: '12px' },
  alertTitle: { fontSize: '16px', color: '#991B1B', margin: '0 0 8px 0' },
  alertText: { fontSize: '14px', color: '#7F1D1D', margin: 0 },
  alertList: { margin: 0, paddingLeft: '20px', color: '#991B1B', fontSize: '14px' },
  alertItem: { marginBottom: '4px' },
  divider: { border: '0', height: '1px', backgroundColor: '#FDE68A', margin: '30px 0' },
  crudSection: {},
  form: { backgroundColor: '#FFFBEB', padding: '20px', borderRadius: '12px', border: '1px solid #FDE68A', marginBottom: '20px' },
  formTitle: { margin: '0 0 12px 0', fontSize: '16px', color: '#92400E' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' },
  input: { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none' },
  editInput: { width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' },
  addButton: { backgroundColor: '#F59E0B', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' },
  tableContainer: { overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  tableHeaderRow: { backgroundColor: '#FEF3C7', color: '#92400E' },
  th: { padding: '12px', borderBottom: '1px solid #E5E7EB' },
  td: { padding: '12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
  tableRow: { transition: 'background 0.2s' },
  productImg: { width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E5E7EB' },
  editBtn: { backgroundColor: '#3B82F6', color: '#white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', color: '#fff' },
  deleteBtn: { backgroundColor: '#EF4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' },
  saveBtn: { backgroundColor: '#10B981', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px' },
  cancelBtn: { backgroundColor: '#6B7280', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }
}
