const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const readline = require('readline');
const fs = require('fs');
const pino = require('pino');

const logger = pino({ level: 'silent' });

let PALABRAS_CLAVE = ['cool', 'bonito', 'guapo', 'lindo', 'wow', 'nice', 'jajaj'];

if (fs.existsSync('./palabras.json')) {
    try {
        PALABRAS_CLAVE = JSON.parse(fs.readFileSync('./palabras.json', 'utf8'));
    } catch (e) {
        console.error('Error al leer palabras.json');
    }
} else {
    fs.writeFileSync('./palabras.json', JSON.stringify(PALABRAS_CLAVE, null, 2));
}

// 🔄 Recarga las palabras si editas el archivo
fs.watchFile('./palabras.json', () => {
    try {
        PALABRAS_CLAVE = JSON.parse(fs.readFileSync('./palabras.json', 'utf8'));
        console.log('🔄 Palabras recargadas:', PALABRAS_CLAVE);
    } catch (e) {
        console.error('Error al recargar palabras');
    }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const OWNER_NUMBER = '5492396522761';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !sock.authState.creds.registered) {
            try {
                const phoneNumber = await question('Ingresa tu número:\n');
                const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(cleanNumber);
                console.log(`\n🔑 Código: ${code}\n`);
            } catch (error) {
                console.error('Error:', error);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ ¡Bot conectado exitosamente!');
            rl.close();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim().toLowerCase();
        const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedKey = m.message.extendedTextMessage?.contextInfo?.stanzaId;
        const quotedParticipant = m.message.extendedTextMessage?.contextInfo?.participant;

        const ownerJid = OWNER_NUMBER + '@s.whatsapp.net';
const isOwner = m.key.remoteJid === ownerJid || m.key.remoteJid === OWNER_NUMBER + '@s.whatsapp.net' || m.key.fromMe === true;        const soyYo = (m.key.participant || m.key.remoteJid || '').includes(OWNER_NUMBER);

        // ➕ .add [palabra]  (o .addpalabra [palabra])
        if (isOwner && (text.startsWith('.add ') || text.startsWith('.addpalabra '))) {
            const nueva = text.replace(/^\.(add|addpalabra)\s+/i, '').trim().toLowerCase();
            if (nueva && !PALABRAS_CLAVE.includes(nueva)) {
                PALABRAS_CLAVE.push(nueva);
                fs.writeFileSync('./palabras.json', JSON.stringify(PALABRAS_CLAVE, null, 2));
                await sock.sendMessage(m.key.remoteJid, { text: `✅ Agregada: ${nueva}` });
            } else {
                await sock.sendMessage(m.key.remoteJid, { text: `⚠️ Ya existe o es inválida` });
            }
            return;
        }

        // ➖ .del [palabra]  (o .delpalabra [palabra])
        if (isOwner && (text.startsWith('.del ') || text.startsWith('.delpalabra '))) {
            const quitar = text.replace(/^\.(del|delpalabra)\s+/i, '').trim().toLowerCase();
            const idx = PALABRAS_CLAVE.indexOf(quitar);
            if (idx !== -1) {
                PALABRAS_CLAVE.splice(idx, 1);
                fs.writeFileSync('./palabras.json', JSON.stringify(PALABRAS_CLAVE, null, 2));
                await sock.sendMessage(m.key.remoteJid, { text: `🗑️ Eliminada: ${quitar}` });
            } else {
                await sock.sendMessage(m.key.remoteJid, { text: `⚠️ No está en la lista` });
            }
            return;
        }

        // 📋 .lista  (o .listarpalabras)
        if (isOwner && (text === '.lista' || text === '.listarpalabras')) {
            await sock.sendMessage(m.key.remoteJid, {
                text: `📋 Palabras activas (${PALABRAS_CLAVE.length}):\n${PALABRAS_CLAVE.join(', ')}`
            });
            return;
        }
// 🏓 .ping
if (isOwner && text === '.ping') {
    const inicio = Date.now();
    await sock.sendMessage(m.key.remoteJid, { text: '🏓 Pong...' });
    const fin = Date.now();
    await sock.sendMessage(m.key.remoteJid, { text: `⚡ ${fin - inicio}ms` });
    return;
}
        // ❓ .help  (o .ayuda)
        if (isOwner && (text === '.help' || text === '.ayuda')) {
            await sock.sendMessage(m.key.remoteJid, {
                text: `🤖 *Comandos:*\n\n.add [palabra] → Agrega\n.del [palabra] → Elimina\n.lista → Ver todas\n.help → Esta ayuda`
            });
            return;
        }

        // 🎯 Detectar palabra clave (solo si vos citás)
if (PALABRAS_CLAVE.includes(text) && (soyYo || isOwner)) {            if (!quoted || !quotedKey) {
                return;
            }

            // Detecta view-once en sus distintas formas
            let viewOnceContent =
                quoted.viewOnceMessageV2?.message ||
                quoted.viewOnceMessage?.message ||
                quoted.viewOnceMessageV2Extension?.message;

            // Si no vino envuelto, revisar el flag viewOnce dentro del medio
            if (!viewOnceContent) {
                const directMedia = quoted.imageMessage || quoted.videoMessage || quoted.audioMessage;
                if (directMedia && directMedia.viewOnce === true) {
                    viewOnceContent = quoted;
                }
            }

            if (!viewOnceContent) {
                return;
            }

            try {
                const buffer = await downloadMediaMessage(
                    { key: { id: quotedKey, remoteJid: m.key.remoteJid, participant: quotedParticipant }, message: quoted },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );

                if (viewOnceContent.imageMessage) {
                    await sock.sendMessage(ownerJid, { image: buffer });
                } else if (viewOnceContent.videoMessage) {
                    await sock.sendMessage(ownerJid, { video: buffer });
                } else if (viewOnceContent.audioMessage) {
                    await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                }
            } catch (error) {
                console.error('Error al capturar:', error.message);
            }
        }
    });
}

connectToWhatsApp();
