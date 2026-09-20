const LOW_STOCK_THRESHOLD = 5; // สต๊อก <= 5 ให้ส่งข้อความเตือนสินค้าใกล้หมดเพิ่ม
const MAX_ITEMS = 50;

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fmt = (n) =>
  Number(n).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ยิงไปที่ https://api.telegram.org/bot<TOKEN>/sendMessage
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
  const unit =
    typeof raw?.unit === 'string' && raw.unit.trim() ? raw.unit.trim().slice(0, 20) : 'ชิ้น';
  if (!name || ![qty, total, stockAfter].every(Number.isFinite)) return null;
  return { name, unit, qty, total, stockAfter };
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

  const time = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  // ---- 1) ข้อความสรุปการขาย (1 ข้อความต่อการกดยืนยันขาย 1 ครั้ง) ----
  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);
  const lines = items.map(
    (i) =>
      `• ${escapeHtml(i.name)} × ${i.qty} ${escapeHtml(i.unit)} = ${fmt(i.total)} บาท` +
      ` (เหลือ ${i.stockAfter})`
  );

  const summary =
    `🛍️ <b>มีรายการขายใหม่!</b>\n` +
    `🕒 ${time}\n\n` +
    `${lines.join('\n')}\n\n` +
    `💰 <b>ยอดรวม: ${fmt(grandTotal)} บาท</b>`;

  let allSent = await sendTelegram(summary);

  // ---- 2) ข้อความเตือนสต๊อกใกล้หมด (แยกอีก 1 ข้อความ ถ้ามีสินค้าเข้าเงื่อนไข) ----
  const lowItems = items.filter((i) => i.stockAfter <= LOW_STOCK_THRESHOLD);
  if (lowItems.length > 0) {
    const lowLines = lowItems.map(
      (i) => `• ${escapeHtml(i.name)} — คงเหลือเพียง ${i.stockAfter} ${escapeHtml(i.unit)}`
    );
    const okLow = await sendTelegram(
      `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
        `${lowLines.join('\n')}\n` +
        `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
    );
    allSent = allSent && okLow;
  }

  return Response.json({ ok: allSent }, { status: allSent ? 200 : 502 });
}
