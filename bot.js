// V2 -descarga de sesion
// Prueba de actualizacion automatica - 17/10
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const readline = require('readline');
const fs = require('fs');
const pino = require('pino');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot activo');
}).listen(process.env.PORT || 3000, () => {
    console.log('🌐 Servidor web escuchando');
});

const logger = pino({ level: 'silent' });
const INICIO = Date.now();
let CAPTURAS = 0;
// 📊 Configuración del reporte
const STATS_URL = 'https://bots-stats-server.onrender.com/reportar';
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
// Si ya existe config.json, cerramos readline (no lo vamos a necesitar)
if (fs.existsSync('./config.json')) {
    try {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        if (config.ownerNumber) {
            rl.close();
        }
    } catch (e) {}
}
// 📂 Lee o crea el config.json con el número del dueño
let OWNER_NUMBER;
let NOMBRE_USUARIO = 'SinNombre';
// 📤 Envía estadísticas al servidor central
async function reportarStats() {
    try {
        const datos = {
            usuario: NOMBRE_USUARIO,
            numero: OWNER_NUMBER,
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

        if (res.ok) {
            console.log('📤 Stats reportadas:', datos.capturas, 'capturas');
        }
    } catch (e) {
        console.error('❌ Error al reportar stats:', e.message);
    }
}
async function cargarOwnerNumber() {
    // Si ya existe config.json, lo usamos
    if (fs.existsSync('./config.json')) {
        try {
            const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            OWNER_NUMBER = config.ownerNumber;
if (config.nombreUsuario) NOMBRE_USUARIO = config.nombreUsuario;
            console.log(`✅ Número cargado: ${OWNER_NUMBER}`);
            return;
        } catch (e) {
            console.error('Error al leer config.json');
        }
    }

    // Si no existe, preguntamos por consola
    const numero = await question('📱 Ingresá tu número de WhatsApp (código país, sin + ni espacios):\n');
const nombre = await question('👤 Ingresá tu nombre para el panel de stats:\n');
NOMBRE_USUARIO = nombre.trim() || 'SinNombre';
    OWNER_NUMBER = numero.replace(/[^0-9]/g, '');
fs.writeFileSync('./config.json', JSON.stringify({ ownerNumber: OWNER_NUMBER, nombreUsuario: NOMBRE_USUARIO }, null, 2));
    console.log(`✅ Número guardado: ${OWNER_NUMBER}`);
    console.log('💡 Si te equivocaste, borrá config.json y volvé a arrancar el bot.\n');
    console.log('💡 Si te equivocaste, borrá config.json y volvé a arrancar el bot.\n');
}
async function connectToWhatsApp() {
let authDir = 'auth_info';
if (process.env.SESSION_URL) {
    console.log('📥 Descargando sesión...');
    const https = require('https');
    const os = require('os');
    const path = require('path');
    authDir = path.join(os.tmpdir(), 'auth_info');
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    const base64 = await new Promise((resolve, reject) => {
        https.get(process.env.SESSION_URL, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
    const json = Buffer.from(base64.trim(), 'base64').toString('utf8');
    const archivos = JSON.parse(json);
    for (const [nombre, contenido] of Object.entries(archivos)) {
        const fullPath = path.join(authDir, nombre);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, contenido);
    }
    console.log('✅ Sesión descargada');
}

const { state, saveCreds } = await useMultiFileAuthState(authDir);

const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: logger,
});
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !sock.authState.creds.registered) {
            try {
const phoneNumber = OWNER_NUMBER;                const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
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
const isOwner = m.key.fromMe === true || m.key.remoteJid === ownerJid || m.key.remoteJid === OWNER_NUMBER + '@s.whatsapp.net';
const soyYo = (m.key.participant || m.key.remoteJid || '').includes(OWNER_NUMBER);
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
// 🎨 .s → convierte foto citada en sticker usando ffmpeg
if (isOwner && text === '.s') {
    if (!quoted || !quotedKey) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Citá una foto para hacer sticker.' });
        return;
    }

    try {
        const buffer = await downloadMediaMessage(
            { key: { id: quotedKey, remoteJid: m.key.remoteJid, participant: quotedParticipant }, message: quoted },
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        const tmpIn = path.join(os.tmpdir(), `sticker_${Date.now()}.jpg`);
        const tmpOut = path.join(os.tmpdir(), `sticker_${Date.now()}.webp`);

        fs.writeFileSync(tmpIn, buffer);

        // Convierte a webp con ffmpeg (512x512, fondo transparente)
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -preset default -an -vsync 0 "${tmpOut}"`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const stickerBuffer = fs.readFileSync(tmpOut);
        await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuffer });

        // Limpieza
        fs.unlinkSync(tmpIn);
        fs.unlinkSync(tmpOut);

    } catch (error) {
        console.error('Error al hacer sticker:', error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ No pude convertir eso en sticker.' });
    }
    return;
}        }
// 🔄 .update → Busca actualizaciones en GitHub y reinicia
if (isOwner && text === '.update') {
    try {
        await sock.sendMessage(m.key.remoteJid, { text: '🔄 Buscando actualizaciones...' });
        
        const { execSync } = require('child_process');
const resultado = execSync('git pull', { cwd: __dirname, encoding: 'utf8' });
        if (resultado.includes('Already up to date') || resultado.includes('Ya está actualizado')) {
            await sock.sendMessage(m.key.remoteJid, { text: '✅ El bot ya está actualizado.' });
        } else {
            await sock.sendMessage(m.key.remoteJid, { text: '🚀 ¡Cambios encontrados! Reiniciando...' });
            setTimeout(() => process.exit(0), 2000);
        }
    } catch (error) {
        console.error('Error en update:', error.message);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Error al actualizar. Avisale a JuanShine.' });
    }
    return;
}
// 🏳️‍🌈 .gay [@usuario] (o citando un mensaje)
if (isOwner && text.startsWith('.gay')) {
    let target = m.key.remoteJid;
    let targetName = 'alguien';

    // Si citaste un mensaje, le aplica el porcentaje al citado
    if (quotedParticipant) {
        target = quotedParticipant;
        targetName = `@${quotedParticipant.split('@')[0]}`;
    } 
    // Si mencionaste a alguien con @, le aplica el porcentaje al mencionado
    else if (m.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        targetName = `@${target.split('@')[0]}`;
    } 
    // Si no citaste ni mencionaste, se lo aplica a vos
    else {
        targetName = 'Vos';
    }

    // Genera un número al azar entre 1 y 100
    const porcentaje = Math.floor(Math.random() * 100) + 1;
    
    // Arma el mensaje
    const mensaje = `🏳️‍🌈 *${targetName}* es ${porcentaje}% gay 🏳️‍🌈`;

    // Envía el mensaje con menciones (para que le llegue la notificación)
    await sock.sendMessage(m.key.remoteJid, { 
        text: mensaje, 
        mentions: target !== m.key.remoteJid ? [target] : []
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
// ⏱️ .uptime
if (isOwner && text === '.uptime') {
    const ms = Date.now() - INICIO;
    const horas = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const segs = Math.floor((ms % 60000) / 1000);
    await sock.sendMessage(m.key.remoteJid, { text: `⏱️ Corriendo hace ${horas}h ${mins}m ${segs}s` });
    return;
}

// 📊 .stats
if (isOwner && text === '.stats') {
    const ms = Date.now() - INICIO;
    const horas = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    await sock.sendMessage(m.key.remoteJid, {
        text: `📊 *Estadísticas del bot*\n\n⏱️ Activo: ${horas}h ${mins}m\n📸 Capturas: ${CAPTURAS}\n📋 Palabras clave: ${PALABRAS_CLAVE.length}`
    });
    return;
}
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
CAPTURAS++;
            } catch (error) {
                console.error('Error al capturar:', error.message);
            }
        }
    });
}

// Arranca todo en orden
(async () => {
    await cargarOwnerNumber();
    connectToWhatsApp();

    // 📤 Reporta al arrancar (esperando 10 segundos a que conecte)
    setTimeout(reportarStats, 10000);

    // 📤 Reporta cada 5 minutos
    setInterval(reportarStats, 5 * 60 * 1000);
})();
