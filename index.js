const { useMultiFileAuthState, makeWASocket } = require('@whiskeysockets/baileys');
const pino = require('pino');

// Initialize logger
const logger = pino({
  level: 'error',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

async function startBot() {
  // Initialize auth state
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  
  // Create WhatsApp connection
  const sock = makeWASocket({
    logger,
    auth: state,
    printQRInTerminal: true,
    browser: ['Node.js Bot', 'Chrome', '120'],
    markOnlineOnConnect: true
  });

  // Connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('🔄 Scan the QR code in WhatsApp > Linked Devices');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log(`Connection closed. ${shouldReconnect ? 'Reconnecting...' : 'Please restart bot'}`);
      if (shouldReconnect) setTimeout(startBot, 5000);
    } 
    
    if (connection === 'open') {
      console.log('✅ Bot successfully connected!');
    }
  });

  // Save credentials
  sock.ev.on('creds.update', saveCreds);

  // Message handling
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg?.message) return;

      const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();
      const sender = msg.key.remoteJid;

      // Basic commands
      if (text.startsWith('!')) {
        const command = text.split(' ')[0];
        switch(command) {
          case '!ping':
            await sock.sendMessage(sender, { text: '🏓 Pong!' });
            break;
          case '!time':
            await sock.sendMessage(sender, { text: `⏰ Time: ${new Date().toLocaleString()}` });
            break;
          default:
            await sock.sendMessage(sender, { text: '❌ Unknown command. Try !ping or !time' });
        }
      }
      // Auto-reply to greetings
      else if (['hi', 'hello', 'hey'].some(g => text.includes(g))) {
        await sock.sendMessage(sender, { text: '👋 Hello! Send !help for commands' });
      }
    } catch (error) {
      logger.error('Message handling error:', error);
    }
  });
}

// Start with error handling
startBot().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});