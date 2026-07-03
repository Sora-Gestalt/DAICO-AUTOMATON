import { NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { email, otp } = body;

        if (!email || !otp) {
            return NextResponse.json({ error: 'Both email parameters and OTP values are structurally required.' }, { status: 400 });
        }

        const db = await getDatabaseConnection();
        const currentTime = new Date().toISOString();

        // 1. Fetch active token parameters by email and expiration window only
        const record = await db.get(
            `SELECT id, otp_code, attempts FROM deletion_otps WHERE leader_email = ? AND expires_at > ?`,
            [email.trim(), currentTime]
        );

        // If no token exists at all for this email or it has expired
        if (!record) {
            return NextResponse.json({ error: 'Invalid or expired verification pin code.' }, { status: 401 });
        }

        // 2. CHECK HISTORICAL LOCKOUTS (If they were already blocked prior)
        if (Number(record.attempts || 0) >= 3) {
            await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [email.trim()]);
            return NextResponse.json({ error: 'Security Lockdown: Too many failed attempts. Request a new PIN.' }, { status: 429 });
        }

        // 3. PIN MATCH VERIFICATION WITH IMMEDIATE INCINERATION THRESHOLD
        if (record.otp_code !== otp.trim()) {
            const newAttemptsValue = Number(record.attempts || 0) + 1;
            
            // Persist the explicit count to SQLite immediately
            await db.run('UPDATE deletion_otps SET attempts = ? WHERE leader_email = ?', [newAttemptsValue, email.trim()]);
            
            // Lock out instantly on strike 3 to prevent logic leak
            if (newAttemptsValue >= 3) {
                await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [email.trim()]);
                return NextResponse.json({ error: 'Security Lockdown: Too many failed attempts. This token has been burned.' }, { status: 429 });
            }

            const remaining = 3 - newAttemptsValue;
            return NextResponse.json({ error: `Incorrect PIN. Security lockdown in ${remaining} more attempts.` }, { status: 401 });
        }

        // 4. Clearance granted: execute cascading deletions natively
        await db.run('DELETE FROM projects WHERE leader_email = ?', [email.trim()]);
        await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [email.trim()]);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Database processing sequence execution failure.' }, { status: 500 });
    }
}