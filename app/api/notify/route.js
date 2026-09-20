import { NextResponse } from "next/server";

const LOW_STOCK_THRESHOLD = 5;

// parse_mode HTML: กันชื่อสินค้าที่มี < > & ทำข้อความพัง
const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendTelegram(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    // ใช้ชื่อแบบ Server (แนะนำ) หรือแบบ NEXT_PUBLIC_ ตามไกด์ก็ได้
    const token =
      process.env.TELEGRAM_BOT_TOKEN ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId =
      process.env.TELEGRAM_CHAT_ID ?? process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ ok: false, reason: "missing telegram env" });
    }

    const { productName, qty, totalPrice, stockAfter } = await request.json();

    const time = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      timeStyle: "medium",
    });

    // งานที่ 1: แจ้งเตือน Order ใหม่
    const messages = [
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${escapeHtml(productName)}\n` +
        `- จำนวน: ${qty} ชิ้น\n` +
        `- ราคารวม: ${Number(totalPrice).toLocaleString("th-TH")} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
        `- เวลา: ${time}`,
    ];

    // งานที่ 2: แจ้งเตือนสต๊อกเหลือน้อย (ส่งเป็นข้อความแยก)
    if (Number(stockAfter) <= LOW_STOCK_THRESHOLD) {
      messages.push(
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${escapeHtml(productName)}\n` +
          `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
      );
    }

    const results = [];
    for (const text of messages) {
      results.push(await sendTelegram(token, chatId, text));
    }

    return NextResponse.json({ ok: results.every(Boolean) });
  } catch (error) {
    // ไม่โยน error ออกไป เพื่อให้ฝั่งหน้าเว็บทำงานต่อได้
    return NextResponse.json({ ok: false, reason: String(error?.message ?? error) });
  }
}
