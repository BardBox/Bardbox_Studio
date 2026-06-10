import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export const runtime = 'nodejs';

async function assertManagerOrAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin'].includes(profile.role)) return null;
  return user;
}

function generatePassword(): string {
  // 12-char password: letters + digits, no ambiguous chars (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

// POST /api/admin/users/[id]/send-reset
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await assertManagerOrAdmin();
    if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const { id } = await params;

    // Get user email + name
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(id);
    if (authErr || !authData?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userEmail = authData.user.email;

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('full_name').eq('id', id).single();
    const fullName = profile?.full_name ?? 'Team Member';

    // Generate a new password and set it directly
    const newPassword = generatePassword();
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: newPassword,
    });
    if (updateErr) {
      console.error('[send-reset] updateUserById failed:', updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Send the password to the employee via email
    const host = process.env.EMAIL_HOST;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      return NextResponse.json(
        { error: 'Email service not configured (EMAIL_HOST/USER/PASS missing)' },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const html = `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px 24px">
        <div style="background:#111;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px">
          <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px">BARDBOX STUDIO</h1>
        </div>

        <h2 style="color:#111;margin:0 0 8px">Your password has been reset</h2>
        <p style="color:#444;margin:0 0 24px">Hi ${fullName}, your Bardbox Studio password has been reset by an admin. Use the credentials below to sign in.</p>

        <table style="border-collapse:collapse;width:100%;margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7">
          <tr>
            <td style="padding:12px 16px;font-weight:600;background:#f4f4f5;color:#555;width:36%;border-bottom:1px solid #e4e4e7">Email</td>
            <td style="padding:12px 16px;color:#111;border-bottom:1px solid #e4e4e7">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-weight:600;background:#f4f4f5;color:#555">New Password</td>
            <td style="padding:12px 16px;font-family:monospace;font-size:16px;letter-spacing:2px;color:#111">${newPassword}</td>
          </tr>
        </table>

        <a href="${appUrl}/login"
          style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px">
          Sign In Now
        </a>

        <p style="margin-top:24px;color:#888;font-size:13px">
          Please change your password after signing in.<br>
          If you didn't expect this, contact your admin immediately.
        </p>
      </div>
    `;

    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.EMAIL_PORT ?? 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user, pass },
    });

    const from = process.env.EMAIL_FROM ?? user;
    await transport.sendMail({
      from: `"Bardbox Studio" <${from}>`,
      to: userEmail,
      subject: 'Your Bardbox Studio password has been reset',
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-reset] Unhandled error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
