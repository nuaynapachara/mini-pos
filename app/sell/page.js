const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
const LOW_STOCK_THRESHOLD = 5;

// กันชื่อสินค้าที่มี < > & ทำให้ Telegram (parse_mode HTML) ส่งไม่ผ่าน
const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ส่งข้อความเข้า Telegram — ไม่ throw ออกนอกฟังก์ชัน จึงไม่กระทบระบบขาย
async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram config missing, skip notification");
    return;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
        }),
      }
    );
    if (!res.ok) {
      console.error("Telegram error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Telegram send failed:", err);
  }
}

// แจ้งเตือนหลังตัดสต๊อกสำเร็จ: Order ใหม่ + (ถ้าเข้าเกณฑ์) Low Stock
async function notifyTelegram({ name, qty, total, stockAfter }) {
  const time = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "medium",
  });
  const safeName = escapeHtml(name);

  await sendTelegram(
    `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${safeName}\n` +
      `- จำนวน: ${qty} ชิ้น\n` +
      `- ราคารวม: ${Number(total).toLocaleString("th-TH")} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
      `- เวลา: ${time}`
  );

  if (stockAfter <= LOW_STOCK_THRESHOLD) {
    await sendTelegram(
      `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
        `- สินค้า: ${safeName}\n` +
        `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
        `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
    );
  }
}
