export function createEmailService({ apiKey, from, appUrl }) {
  const enabled = Boolean(apiKey && from);

  const send = async ({ to, subject, html }) => {
    if (!enabled) return false;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
    return true;
  };

  return {
    enabled,
    sendVerification: (email, token) => send({
      to: email,
      subject: 'Verify your TypeSense email',
      html: `<p>Confirm your TypeSense account:</p><p><a href="${appUrl}/?verify=${encodeURIComponent(token)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    }),
    sendPasswordReset: (email, token) => send({
      to: email,
      subject: 'Reset your TypeSense password',
      html: `<p>Reset your TypeSense password:</p><p><a href="${appUrl}/?reset=${encodeURIComponent(token)}">Reset password</a></p><p>This link expires in one hour.</p>`,
    }),
  };
}
