const net = require('net');
const tls = require('tls');

const SUBJECT_LABELS = {
  bug: 'Сообщение об ошибке',
  feature: 'Предложение по улучшению',
  question: 'Вопрос по использованию',
  partnership: 'Сотрудничество',
  other: 'Другое'
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toBase64(value) {
  return Buffer.from(String(value), 'utf8').toString('base64');
}

function createConnection({ host, port, secure }) {
  return secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });
}

function readLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };

    const onData = (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line) continue;
        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (match && match[2] === ' ') {
          cleanup();
          resolve({ code: Number(match[1]), line, raw: line });
          return;
        }
      }
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    socket.on('data', onData);
    socket.once('error', onError);
  });
}

async function sendCommand(socket, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  const response = await readLine(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP error after "${command}": ${response.raw}`);
  }
  return response;
}

async function sendEmailNotification({ from, to, replyTo, subject, text }) {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!host || !user || !pass) {
    return false;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true').trim() === 'true';
  const socket = createConnection({ host, port, secure });
  socket.setEncoding('utf8');

  try {
    await readLine(socket);
    await sendCommand(socket, `EHLO ${process.env.SMTP_EHLO_HOST || 'localhost'}`, [250]);
    await sendCommand(socket, 'AUTH LOGIN', [334]);
    await sendCommand(socket, toBase64(user), [334]);
    await sendCommand(socket, toBase64(pass), [235]);
    await sendCommand(socket, `MAIL FROM:<${from}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await sendCommand(socket, 'DATA', [354]);

    const headers = [
      `From: Eco Tracker <${from}>`,
      `To: <${to}>`,
      `Reply-To: ${replyTo}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text.replace(/\n\./g, '\n..')
    ].join('\r\n');

    socket.write(`${headers}\r\n.\r\n`);
    const dataResponse = await readLine(socket);
    if (dataResponse.code !== 250) {
      throw new Error(`SMTP error after DATA: ${dataResponse.raw}`);
    }

    await sendCommand(socket, 'QUIT', [221]);
    return true;
  } finally {
    if (!socket.destroyed) {
      socket.end();
    }
  }
}

async function sendContactNotification(payload) {
  const recipientEmail = String(process.env.CONTACT_RECIPIENT_EMAIL || 'mkutov13@gmail.com').trim();
  const senderEmail = String(process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER || recipientEmail).trim();

  const subjectLabel = SUBJECT_LABELS[payload.subject] || SUBJECT_LABELS.other;
  const subject = `[Eco Tracker] ${subjectLabel}`;
  const timestamp = new Date().toISOString();
  const text = [
    'Новое сообщение с формы контактов',
    '',
    `Имя: ${payload.name}`,
    `Email: ${payload.email}`,
    `Тема: ${subjectLabel}`,
    '',
    'Сообщение:',
    payload.message,
    '',
    `Дата: ${timestamp}`
  ].join('\n');

  const emailSent = await sendEmailNotification({
    from: senderEmail,
    to: recipientEmail,
    replyTo: payload.email,
    subject,
    text
  });

  if (payload.copyToSender && payload.email.toLowerCase() !== recipientEmail.toLowerCase()) {
    await sendEmailNotification({
      from: senderEmail,
      to: payload.email,
      replyTo: recipientEmail,
      subject: `Копия вашего сообщения — ${subjectLabel}`,
      text: [
        'Вы отправили сообщение через форму контактов Eco Tracker.',
        '',
        text
      ].join('\n')
    });
  }

  if (!emailSent) {
    throw new Error('Не удалось отправить email с формы контактов');
  }

  return { emailSent };
}

module.exports = {
  SUBJECT_LABELS,
  sendContactNotification
};
