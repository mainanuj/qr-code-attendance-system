import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.resolve(__dirname, 'assets/attendly-logo.png');
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendOtpEmail({ toEmail, otpCode, purpose, recipientName = 'Teacher' }) {
  const isRegister = purpose === 'register';
  const subject = isRegister
    ? `${otpCode} is your Attendly registration verification code`
    : `${otpCode} is your Attendly password reset code`;

  const headingText = isRegister ? 'Verify your email address' : 'Reset your password';
  const descriptionText = isRegister
    ? 'Thank you for signing up for Attendly. Enter the verification code below on the registration page to activate your teacher account:'
    : 'We received a request to reset the password for your Attendly teacher account. Enter the verification code below to proceed:';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headingText}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c1222; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c1222; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #162036; border: 1px solid #293859; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);">
          <!-- Header with Official Attendly Logo -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #23314f; background: linear-gradient(180deg, #1d2b49 0%, #162036 100%);">
              <img src="cid:attendly-brand-logo" width="56" height="56" alt="Attendly Logo" style="display: block; margin: 0 auto 12px auto; width: 56px; height: 56px; border-radius: 14px; box-shadow: 0 6px 20px rgba(0, 245, 212, 0.35); border: 1px solid rgba(56, 189, 248, 0.3);" />
              <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Attendly</h2>
              <p style="margin: 4px 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #818cf8;">QR Attendance System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #f8fafc; text-align: center;">${headingText}</h1>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
                Hello <strong>${recipientName}</strong>,<br>${descriptionText}
              </p>

              <!-- OTP Code Box -->
              <div style="background-color: #0b1325; border: 1px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
                <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #a5b4fc; font-family: 'Courier New', Courier, monospace; display: inline-block; padding-left: 8px;">
                  ${otpCode}
                </span>
                <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Valid for 10 minutes only</p>
              </div>

              <div style="background-color: #1e293b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #cbd5e1;">
                  ⚠️ <strong>Security notice:</strong> If you did not make this request, please disregard this email or contact support. Never share this code with anyone.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
                Need help? Reply directly to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                © ${new Date().getFullYear()} Attendly QR Attendance System. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  // 1. If GMAIL_APP_PASS and GMAIL_USER are configured, use Gmail SMTP directly with inline CID logo attachment
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS.replace(/\s+/g, '') // strips spaces if user copied with spaces
      }
    });

    const attachments = fs.existsSync(logoPath) ? [
      {
        filename: 'attendly-logo.png',
        path: logoPath,
        cid: 'attendly-brand-logo'
      }
    ] : [];

    const info = await transporter.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME || 'Attendly'}" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent,
      attachments
    });
    console.log('OTP sent via Gmail SMTP with logo:', info.messageId);
    return { messageId: info.messageId, provider: 'gmail' };
  }

  // 2. Otherwise use Brevo API
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'kumaranuj04754@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Attendly';

  if (!apiKey) {
    throw new Error('Email service is not configured. Add GMAIL_APP_PASS or BREVO_API_KEY.');
  }

  const base64Logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const attachment = base64Logo ? [{ name: 'attendly-logo.png', content: base64Logo }] : undefined;

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: recipientName }],
      subject,
      htmlContent,
      attachment
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Brevo API Error:', response.status, errorText);
    let parsedMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      parsedMessage = parsed.message || errorText;
    } catch { /* use errorText */ }
    throw new Error(`Failed to send email (${response.status}): ${parsedMessage}`);
  }

  const result = await response.json();
  console.log('OTP sent via Brevo API:', result.messageId);
  return result;
}
