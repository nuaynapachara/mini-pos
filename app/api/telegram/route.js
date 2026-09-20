// app/api/notify/route.js
// รันบนเซิร์ฟเวอร์เท่านั้น: Token ไม่ถูกส่งไปที่เบราว์เซอร์
import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LOW_STOCK_THRESHOLD = 5;

// กัน HTML แตกเวลาชื่อสินค้ามีอักขระพิเศษ (parse_mode: HTML)
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

async function sendTelegram(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.error('[Telegram] ส่งไม่สำเร็จ:', res.status, await res.text());
    }
    return res.ok;
  } catch (err) {
    console.error('[Telegram] error:', err);
    return false;
  }
}

export async function POST(request) {
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn('[Telegram] ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
      return NextResponse.json({ ok: false, error: 'not configured' }, { status: 200 });
    }

    const body = await request.json();
    const name = String(body?.name ?? '').slice(0, 200);
    const qty = Number(body?.qty);
    const total = Number(body?.total);
    const stockAfter = Number(body?.stockAfter);

    if (!name || ![qty, total, stockAfter].every(Number.isFinite)) {
      return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
    }

    const time = new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    // งานที่ 1: มีรายการขายใหม่
    await sendTelegram(
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${esc(name)}\n` +
        `- จำนวน: ${qty} ชิ้น\n` +
        `- ราคารวม: ${total.toLocaleString('th-TH')} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
        `- เวลา: ${time}`
    );

    // งานที่ 2: สต๊อกใกล้หมด (แยกอีก 1 ข้อความ)
    if (stockAfter <= LOW_STOCK_THRESHOLD) {
      await sendTelegram(
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${esc(name)}\n` +
          `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram] route error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
