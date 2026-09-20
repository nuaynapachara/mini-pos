'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient' // ปรับ path ตามโครงสร้างโปรเจกต์จริงของคุณ

export default function SellPage() {
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  // โหลดรายการสินค้าเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true })
    if (error) console.error('Error fetching products:', error)
    else setProducts(data || [])
  }

  // 🚀 ฟังก์ชันส่งข้อความเข้า Telegram API
  async function sendTelegramNotification(messageText) {
    try {const botToken = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TELEGRAM_CHAT_ID

      // ถ้ายังไม่ได้ตั้งค่า Token หรือ Chat ID ใน .env / Vercel ให้ข้ามการส่งแต่ไม่ให้แอปพัง
      if (!botToken || !chatId) {
        console.warn('Telegram token or chat ID is missing.')
        return
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
        }),
      })

      const result = await response.json()
      if (!result.ok) {
        console.error('Telegram API Error:', result.description)
      }
    } catch (err) {
      // ป้องกันไม่ให้ error ของ Telegram ส่งผลกระทบต่อระบบขายหน้าร้าน
      console.error('Failed to send Telegram notification:', err)
    }
  }

  // ฟังก์ชันดำเนินการขายและตัดสต๊อก
  async function handleCheckout(e) {
    e.preventDefault()
    if (!selectedProduct) {
      alert('กรุณาเลือกสินค้า')
      return
    }

    const qtyToSell = parseInt(quantity)
    if (qtyToSell <= 0) {
      alert('จำนวนสินค้าต้องมากกว่า 0')
      return
    }

    const product = products.find(p => p.id === selectedProduct)
    if (!product) {
      alert('ไม่พบข้อมูลสินค้า')
      return
    }

    if (product.stock < qtyToSell) {
      alert(`สินค้าในสต็อกไม่เพียงพอ (เหลือ ${product.stock} ${product.unit || 'ชิ้น'})`)
      return
    }

    setLoading(true)

    try {
      const newStock = product.stock - qtyToSell
      const totalPrice = Number(product.price) * qtyToSell
      const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })

      // 1. บันทึกลงตาราง sales
      const { error: saleError } = await supabase.from('sales').insert([
        {
          product_id: product.id,
          product_name: product.name,
          quantity: qtyToSell,
          total_price: totalPrice,
        }
      ])
      if (saleError) throw saleError

      // 2. อัปเดตตัดสต๊อกในตาราง products
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id)
      if (updateError) throw updateError

      // -----------------------------------------------------------------
      // 3. งานที่ 1: ส่งข้อความแจ้งเตือน New Order เข้า Telegram Channel
      // -----------------------------------------------------------------
      const orderMessage = 
        `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${product.name}\n` +
        `- จำนวน: ${qtyToSell} ${product.unit || 'ชิ้น'}\n` +
        `- ราคารวม: ${totalPrice.toLocaleString()} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ${product.unit || 'ชิ้น'}\n` +
        `- เวลา: ${currentTime}`

      await sendTelegramNotification(orderMessage)

      // -----------------------------------------------------------------
      // 4. งานที่ 2: ส่งข้อความแจ้งเตือน Low Stock Alert หาก Stock <= 5
      // -----------------------------------------------------------------
      if (newStock <= 5) {
        const lowStockMessage = 
          `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${product.name}\n` +
          `- คงเหลือเพียง: ${newStock} ${product.unit || 'ชิ้น'}\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`

        await sendTelegramNotification(lowStockMessage)
      }

      alert('บันทึกการขายและตัดสต๊อกสำเร็จ!')
      
      // รีเซ็ตฟอร์มและรีเฟรชข้อมูลสินค้า
      setSelectedProduct('')
      setQuantity(1)
      fetchProducts()

    } catch (error) {
      console.error('Checkout error:', error)
      alert('เกิดข้อผิดพลาดในการทำรายการ: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>🛒 หน้าขายสินค้า (POS) - Meow O shop</h1>

      <form onSubmit={handleCheckout} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>เลือกสินค้า:</label>
          <select
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            style={styles.select}
            required
          >
            <option value="">-- กรุณาเลือกสินค้า --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (ราคา: {p.price} บาท | เหลือ: {p.stock} {p.unit})
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>จำนวน:</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'กำลังประมวลผล...' : 'ยืนยันการขาย'}
        </button>
      </form>
    </main>
  )
}

// สไตล์การตกแต่งโทนอบอุ่น
const styles = {
  container: { padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: '#4A3525' },
  title: { textAlign: 'center', color: '#D97706', marginBottom: '20px' },
  form: { backgroundColor: '#FFFBEB', padding: '20px', borderRadius: '12px', border: '1px solid #FDE68A' },
  formGroup: { marginBottom: '15px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#92400E' },
  select: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px' },
  button: { backgroundColor: '#F59E0B', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '16px' }
}
