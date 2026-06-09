const SUBJECT_LABELS = {
  bug: 'Сообщение об ошибке',
  feature: 'Предложение по улучшению',
  question: 'Вопрос по использованию',
  partnership: 'Сотрудничество',
  other: 'Другое'
};

const DEFAULT_FROM = 'Eco Tracker <onboarding@resend.dev>';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getResendConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('Не задан RESEND_API_KEY. Добавьте ключ Resend в переменные окружения.');
  }

  return {
    apiKey,
    from: DEFAULT_FROM,
    recipientEmail: String(process.env.CONTACT_RECIPIENT_EMAIL || 'mkutov13@gmail.com').trim()
  };
}

function buildMessageText({ name, email, subjectLabel, message, timestamp }) {
  return [
    'Новое сообщение с формы контактов',
    '',
    `Имя: ${name}`,
    `Email: ${email}`,
    `Тема: ${subjectLabel}`,
    '',
    'Сообщение:',
    message,
    '',
    `Дата: ${timestamp}`
  ].join('\n');
}

function buildMessageHtml({ name, email, subjectLabel, message, timestamp }) {
  return `
    <h2>Новое сообщение с формы контактов</h2>
    <ul>
      <li><strong>Имя:</strong> ${escapeHtml(name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Тема:</strong> ${escapeHtml(subjectLabel)}</li>
    </ul>
    <p><strong>Сообщение:</strong></p>
    <div style="white-space: pre-wrap; border-left: 4px solid #28a745; padding-left: 12px;">${escapeHtml(message)}</div>
    <p style="color: #6c757d; font-size: 12px;">Дата: ${escapeHtml(timestamp)}</p>
  `;
}

async function sendViaResend({ apiKey, from, to, replyTo, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Ошибка Resend API: ${response.status} ${bodyText}`);
  }

  return response.json();
}

async function sendContactNotification(payload) {
  const { apiKey, from, recipientEmail } = getResendConfig();
  const subjectLabel = SUBJECT_LABELS[payload.subject] || SUBJECT_LABELS.other;
  const subject = `[Eco Tracker] ${subjectLabel}`;
  const timestamp = new Date().toISOString();
  const text = buildMessageText({
    name: payload.name,
    email: payload.email,
    subjectLabel,
    message: payload.message,
    timestamp
  });
  const html = buildMessageHtml({
    name: payload.name,
    email: payload.email,
    subjectLabel,
    message: payload.message,
    timestamp
  });

  await sendViaResend({
    apiKey,
    from,
    to: recipientEmail,
    replyTo: payload.email,
    subject,
    text,
    html
  });

  if (payload.copyToSender && payload.email.toLowerCase() !== recipientEmail.toLowerCase()) {
    await sendViaResend({
      apiKey,
      from,
      to: payload.email,
      replyTo: recipientEmail,
      subject: `Копия вашего сообщения — ${subjectLabel}`,
      text: [
        'Вы отправили сообщение через форму контактов Eco Tracker.',
        '',
        text
      ].join('\n'),
      html: `<p>Вы отправили сообщение через форму контактов Eco Tracker.</p><hr />${html}`
    });
  }

  return { emailSent: true };
}

module.exports = {
  SUBJECT_LABELS,
  sendContactNotification
};
