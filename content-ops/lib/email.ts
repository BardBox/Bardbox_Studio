import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user, pass },
  });
}

export async function sendWelcomeEmail({
  to,
  fullName,
  tempPassword,
  appUrl,
}: {
  to: string;
  fullName: string;
  tempPassword: string;
  appUrl: string;
}) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[email] EMAIL_HOST/USER/PASS not set — skipping welcome email');
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;

  await transport.sendMail({
    from: `"Bardbox Studio" <${from}>`,
    to,
    subject: "You've been added to Bardbox Studio",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#111">Welcome to Bardbox Studio, ${fullName}!</h2>
        <p>Your account has been created. Use the credentials below to sign in:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f4f4f5;border:1px solid #e4e4e7">Email</td>
            <td style="padding:8px;border:1px solid #e4e4e7">${to}</td>
          </tr>
          <tr>
            <td style="padding:8px;font-weight:bold;background:#f4f4f5;border:1px solid #e4e4e7">Temporary Password</td>
            <td style="padding:8px;font-family:monospace;letter-spacing:1px;border:1px solid #e4e4e7">${tempPassword}</td>
          </tr>
        </table>
        <a href="${appUrl}/login" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Sign in now</a>
        <p style="margin-top:24px;color:#666;font-size:13px">Please change your password after your first sign-in.</p>
      </div>
    `,
  });

  return { sent: true };
}
