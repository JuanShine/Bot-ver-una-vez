const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const readline = require('readline');
const fs = require('fs');
const pino = require('pino');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const express = require('express');

// 🔐 Configuración del servidor web
const app = express();
app.use(express.json());
const PASSWORD = "micontraseña123"; // CAMBIÁ ESTO POR TU CONTRASEÑA

// Configuración del bot
const INICIO = Date.now();
let CAPTURAS = 0;
let PALABRAS_CLAVE = ['cool', 'bonito', 'guapo', 'lindo', 'wow', 'nice', 'jajaj', 'pete', 'trans', 'lesbiana'];
const STATS_URL = 'https://bots-stats-server.onrender.com/reportar';
const NOMBRE_USUARIO = 'JuanShine';

// Si existe palabras.json, lo usamos
if (fs.existsSync('./palabras.json')) {
    try {
        PALABRAS_CLAVE = JSON.parse(fs.readFileSync('./palabras.json', 'utf8'));
    } catch (e) {}
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const OWNER_NUMBER = '5492396522761'; // Tu número (A)

// 📂 Lee o crea el config.json con el número del dueño
let OWNER_NUMBER_FINAL;
if (fs.existsSync('./config.json')) {
    try {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        OWNER_NUMBER_FINAL = config.ownerNumber || OWNER_NUMBER;
    } catch (e) {}
} else {
    OWNER_NUMBER_FINAL = OWNER_NUMBER;
}

// 📤 Envía estadísticas al servidor central
async function reportarStats() {
    try {
        const datos = {
            usuario: NOMBRE_USUARIO,
            numero: OWNER_NUMBER_FINAL,
            capturas: CAPTURAS,
            uptime: Date.now() - INICIO,
            palabras: PALABRAS_CLAVE.length,
            comandos: 0
        };
        const res = await fetch(STATS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
    } catch (e) {}
}

// 🌐 Función que crea la conexión para cada sesión
async function connectToWhatsApp(sessionName) {
    const sessionPath = path.join(__dirname, 'sessions', sessionName);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !sock.authState.creds.registered) {
            try {
                const phoneNumber = await question(`📱 Ingresá tu número para la sesión ${sessionName}:\n`);
                const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(cleanNumber);
                console.log(`\n🔑 Código para ${sessionName}: ${code}\n`);
            } catch (error) {}
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp(sessionName);
        } else if (connection === 'open') {
            console.log(`✅ ¡Bot conectado exitosamente (${sessionName})!`);
            rl.close();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 🎯 Lógica de los mensajes (La misma que tenías, pero aplicada a la sesión)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim().toLowerCase();
        const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedKey = m.message.extendedTextMessage?.contextInfo?.stanzaId;
        const quotedParticipant = m.message.extendedTextMessage?.contextInfo?.participant;

        const ownerJid = OWNER_NUMBER_FINAL + '@s.whatsapp.net';
        const isOwner = m.key.remoteJid === ownerJid || m.key.remoteJid === OWNER_NUMBER_FINAL + '@s.whatsapp.net' || m.key.fromMe === true;
        const soyYo = (m.key.participant || m.key.remoteJid || '').includes(OWNER_NUMBER_FINAL);

        // Comandos de administración (solo para vos)
        if (isOwner && text.startsWith('.add ')) { /* ... tu código de .add ... */ }
        if (isOwner && text === '.lista') { /* ... tu código de .lista ... */ }
        
        // Comando .ping
        if (isOwner && text === '.ping') {
            const inicio = Date.now();
            await sock.sendMessage(m.key.remoteJid, { text: '🏓 Pong...' });
            const fin = Date.now();
            await sock.sendMessage(m.key.remoteJid, { text: `⚡ ${fin - inicio}ms` });
            return;
        }

        // Comando .s (stickers)
        if (isOwner && text.includes('.s')) {
            if (!quoted || !quotedKey) return;
            try {
                const buffer = await downloadMediaMessage(
                    { key: { id: quotedKey, remoteJid: m.key.remoteJid, participant: quotedParticipant }, message: quoted },
                    'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                const tmpIn = path.join(os.tmpdir(), `sticker_${Date.now()}.jpg`);
                const tmpOut = path.join(os.tmpdir(), `sticker_${Date.now()}.webp`);
                fs.writeFileSync(tmpIn, buffer);
                await new Promise((resolve, reject) => {
                    exec(`ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -preset default -an -vsync 0 "${tmpOut}"`, (err) => err ? reject(err) : resolve());
                });
                const stickerBuffer = fs.readFileSync(tmpOut);
                await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuffer });
                fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut);
            } catch (e) {}
            return;
        }

        // Comandos Gay, Pete, etc.
        if (text.startsWith('.gay') || text.startsWith('.pete') || text.startsWith('.trans') || text.startsWith('.lesbiana')) {
            let target = m.key.remoteJid;
            let targetName = 'Vos';
            if (quotedParticipant) { target = quotedParticipant; targetName = `@${quotedParticipant.split('@')[0]}`; }
            else if (m.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
                targetName = `@${target.split('@')[0]}`;
            }
            const porcentaje = Math.floor(Math.random() * 100) + 1;
            let emoji = text.startsWith('.gay') ? '🏳️‍🌈' : text.startsWith('.pete') ? '🍆' : text.startsWith('.trans') ? '🏳️‍⚧️' : '👩‍❤️‍💋‍👩';
            let palabra = text.replace('.', '');
            await sock.sendMessage(m.key.remoteJid, { 
                text: `${emoji} *${targetName}* es ${porcentaje}% ${palabra} ${emoji}`, 
                mentions: target !== m.key.remoteJid ? [target] : []
            });
            return;
        }

        // Captura de "ver un vez" (la lógica de tu código original)
        if (PALABRAS_CLAVE.includes(text) && (soyYo || isOwner)) {
            if (!quoted || !quotedKey) return;
            let viewOnceContent = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;
            if (!viewOnceContent) {
                const directMedia = quoted.imageMessage || quoted.videoMessage || quoted.audioMessage;
                if (directMedia && directMedia.viewOnce === true) viewOnceContent = quoted;
            }
            if (!viewOnceContent) return;
            try {
                const buffer = await downloadMediaMessage(
                    { key: { id: quotedKey, remoteJid: m.key.remoteJid, participant: quotedParticipant }, message: quoted },
                    'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                // Le manda la foto a quien la capturó (o a vos si sos el dueño)
                const targetJid = isOwner ? ownerJid : m.key.remoteJid;
                if (viewOnceContent.imageMessage) await sock.sendMessage(targetJid, { image: buffer });
                else if (viewOnceContent.videoMessage) await sock.sendMessage(targetJid, { video: buffer });
                else if (viewOnceContent.audioMessage) await sock.sendMessage(targetJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                CAPTURAS++;
            } catch (e) {}
        }
    });

    return sock;
}

// 🌐 Iniciar servidor web
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post('/api/connect', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Falta el número' });

    try {
        const sessionName = 'user_' + number;
        const sock = await connectToWhatsApp(sessionName);
        const code = await sock.requestPairingCode(number);
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: 'Error al conectar' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor web listo en puerto ${PORT}`);
    setTimeout(reportarStats, 10000);
    setInterval(reportarStats, 5 * 60 * 1000);
});

// Iniciar la sesión principal de JuanShine
connectToWhatsApp('principal');
