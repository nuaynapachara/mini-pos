 app/api/notify/route.js
// ส่งแจ้งเตือน Telegram จากฝั่ง Server — token/chat id ไม่หลุดไปที่ browser
// ตั้งค่าใน .env.local (ไม่มี NEXT_PUBLIC_ นำหน้า):
//   TELEGRAM_BOT_TOKEN=...
//   TELEGRAM_CHAT_ID=...

const LOW_STOCK_THRESHOLD = 5; // สต๊อก <= 5 ให้แจ้งเตือนสินค้าใกล้หมด
const MAX_ITEMS = 50;

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Telegram env is missing (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      console.error('Telegram error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Telegram notify failed:', err);
    return false;
  }
}

// ตรวจข้อมูลที่ client ส่งมา และจำกัดชนิดข้อมูล (ไม่รับข้อความอิสระ)
function sanitizeItem(raw) {
  const qty = Number(raw?.qty);
  const total = Number(raw?.total);
  const stockAfter = Number(raw?.stockAfter);
  const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 200) : '';
  if (!name || ![qty, total, stockAfter].every(Number.isFinite)) return null;
  return { name, qty, total, stockAfter };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const items = (Array.isArray(body?.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .map(sanitizeItem)
    .filter(Boolean);

  if (items.length === 0) {
    return Response.json({ ok: false, error: 'no valid items' }, { status: 400 });
  }

  let allSent = true;

  // ส่งทีละรายการตามลำดับ เพื่อให้ข้อความเข้าช่องเรียงถูกต้อง
  for (const { name, qty, total, stockAfter } of items) {
    const safeName = escapeHtml(name);
    const time = new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const okOrder = await sendTelegram(
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${safeName}\n` +
        `- จำนวน: ${qty} ชิ้น\n` +
        `- ราคารวม: ${total.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
        `- เวลา: ${time}`
    );
    if (!okOrder) allSent = false;

    if (stockAfter <= LOW_STOCK_THRESHOLD) {
      const okLow = await sendTelegram(
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${safeName}\n` +
          `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
      );
      if (!okLow) allSent = false;
    }
  }

  return Response.json({ ok: allSent }, { status: allSent ? 200 : 502 });
}
