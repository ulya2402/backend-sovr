import { Env, TelegramMessage, TelegramCallbackQuery } from "./types";
import { sendTelegramMessage, editTelegramMessage, answerCallbackQuery } from "./telegram";

function getTodayDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

export async function handleIncomingMessage(env: Env, message: TelegramMessage): Promise<void> {
  if (!message.text || !message.from) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const user = message.from;
  const userId = user.id.toString();

  // PERINTAH: /start
  if (text === "/start") {
    try {
      await env.sovr_db.prepare(`INSERT OR IGNORE INTO users (id, username, first_name) VALUES (?, ?, ?)`)
        .bind(user.id, user.username || null, user.first_name)
        .run();
    } catch (error) {}
    const welcomeMsg = `Halo <b>${user.first_name}</b>!\n\nSelamat datang di SOVR Bot.\n\nKetik /terbaru untuk membaca insight.\n\n👉 <b><a href="https://sovr-frontend.vercel.app">Buka Web SOVR</a></b>`;
    await sendTelegramMessage(env, chatId, welcomeMsg);
    return;
  }

  // PERINTAH: /terbaru
  if (text === "/terbaru") {
    try {
      const { results } = await env.sovr_db.prepare(`SELECT * FROM articles WHERE status = 'published' ORDER BY id DESC LIMIT 3`).all();
      if (!results || results.length === 0) {
        await sendTelegramMessage(env, chatId, "Belum ada artikel saat ini.");
        return;
      }
      let replyText = "📰 <b>Insight Terbaru SOVR</b>\n\n";
      results.forEach((article: any) => {
        replyText += `▪️ <b>[${article.tag}] ${article.title}</b>\n`;
        replyText += `<i>${article.body.substring(0, 80)}...</i>\n`;
        replyText += `<a href="${article.source_url}">Baca selengkapnya</a>\n\n`;
      });
      await sendTelegramMessage(env, chatId, replyText);
    } catch (error: any) {
      await sendTelegramMessage(env, chatId, `[System Log] Database error: ${error.message}`);
    }
    return;
  }

  // FITUR KHUSUS ADMIN: /post
  if (text.startsWith("/post")) {
    // LOG 1: Cek apakah ID Admin terbaca
    await sendTelegramMessage(env, chatId, `[DEBUG 1] Memeriksa Hak Akses...\nID Anda: ${userId}\nAdmin ID di Sistem: ${env.ADMIN_ID}`);
    
    if (userId !== env.ADMIN_ID) {
      await sendTelegramMessage(env, chatId, "⛔ Maaf, perintah ini hanya untuk Admin redaksi SOVR.");
      return;
    }

    try {
      const lines = text.split('\n');
      let judul = "", tanggal = "", penulis = "", kategori = "", isi = "";
      
      lines.forEach(line => {
        const l = line.toLowerCase();
        if (l.startsWith("judul :") || l.startsWith("judul:")) judul = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("tanggal :") || l.startsWith("tanggal:")) tanggal = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("penulis :") || l.startsWith("penulis:")) penulis = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("kategori :") || l.startsWith("kategori:")) kategori = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("isi artikel :") || l.startsWith("isi artikel:")) isi = line.substring(line.indexOf(":") + 1).trim();
      });

      // LOG 2: Cek hasil potong teks
      await sendTelegramMessage(env, chatId, `[DEBUG 2] Data Terbaca:\nJudul: ${judul}\nTanggal: ${tanggal}\nPenulis: ${penulis}\nKategori: ${kategori}\nIsi: ${isi}`);

      if (!judul || !tanggal || !penulis || !kategori || !isi) {
        await sendTelegramMessage(env, chatId, "❌ <b>Format Salah/Tidak Lengkap!</b>");
        return;
      }

      const sentences = isi.split(/[.?!]/).filter(s => s.trim().length > 0);
      if (sentences.length > 4) {
        await sendTelegramMessage(env, chatId, `❌ <b>Isi terlalu panjang!</b> Maksimal 4 kalimat. Anda memasukkan ${sentences.length} kalimat.`);
        return;
      }

      if (tanggal.toUpperCase() === "NOW") tanggal = getTodayDate();

      const catSlug = kategori.toLowerCase();
      let icon = "ri-newspaper-line", tagBaru = "Market", slugDB = "market";
      
      if (catSlug.includes("ai")) { icon = "ri-sparkling-2-line"; tagBaru = "AI"; slugDB = "ai"; }
      else if (catSlug.includes("kripto")) { icon = "ri-coin-line"; tagBaru = "Kripto"; slugDB = "kripto"; }
      else if (catSlug.includes("market")) { icon = "ri-line-chart-line"; tagBaru = "Market"; slugDB = "market"; }
      else if (catSlug.includes("defi")) { icon = "ri-swap-line"; tagBaru = "DeFi"; slugDB = "defi"; }

      const insertQuery = `INSERT INTO articles (tag, category, title, body, author, source_name, source_url, source_logo, published_date, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0) RETURNING id`;
      const result = await env.sovr_db.prepare(insertQuery)
        .bind(tagBaru, slugDB, judul, isi, penulis, "SOVR Internal", "#", icon, tanggal)
        .first();

      const articleId = result?.id;

      const previewMsg = `📝 <b>PREVIEW DRAFT</b>\n\n<b>Judul:</b> ${judul}\n<b>Kategori:</b> ${tagBaru}\n<b>Isi:</b> ${isi}\n\n<i>Pilih tindakan:</i>`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "✅ Posting Biasa", callback_data: `pub_norm_${articleId}` }],
          [{ text: "🌟 Pilihan Editor", callback_data: `pub_edit_${articleId}` }],
          [{ text: "❌ Batal & Hapus", callback_data: `cancel_${articleId}` }]
        ]
      };

      await sendTelegramMessage(env, chatId, previewMsg, keyboard);
    } catch (error: any) {
      await sendTelegramMessage(env, chatId, `[System Error] Gagal memproses post: ${error.message}`);
    }
    return;
  }

  // PESAN DEFAULT BARU (Untuk memastikan kode benar-benar berhasil di-deploy)
  const defaultMsg = `[V2 DEPLOY BERHASIL]\nPesan yang Anda kirim: ${text}`;
  await sendTelegramMessage(env, chatId, defaultMsg);
}

export async function handleCallbackQuery(env: Env, callbackQuery: TelegramCallbackQuery): Promise<void> {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat.id;
  const messageId = callbackQuery.message?.message_id;
  const userId = callbackQuery.from.id.toString();

  if (!chatId || !messageId) return;

  if (userId !== env.ADMIN_ID) {
    await answerCallbackQuery(env, callbackQuery.id, "Anda bukan Admin!");
    return;
  }

  try {
    const action = data.slice(0, 8); 
    const articleId = data.split('_')[2];

    if (action === "cancel__") {
      await env.sovr_db.prepare(`DELETE FROM articles WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "❌ <i>Draft dibatalkan dan dihapus.</i>");
    } 
    else if (action === "pub_norm") {
      await env.sovr_db.prepare(`UPDATE articles SET status = 'published', featured = 0 WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "✅ <b>Sukses!</b> Artikel telah di-publish sebagai <b>Berita Biasa</b>.");
    }
    else if (action === "pub_edit") {
      await env.sovr_db.prepare(`UPDATE articles SET status = 'published', featured = 1 WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "🌟 <b>Sukses!</b> Artikel telah di-publish sebagai <b>Pilihan Editor</b>.");
    }

    await answerCallbackQuery(env, callbackQuery.id, "Berhasil diproses!");
  } catch (error: any) {
    await editTelegramMessage(env, chatId, messageId, `[Error] ${error.message}`);
  }
}