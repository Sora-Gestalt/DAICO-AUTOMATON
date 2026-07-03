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

        // 1. Fetch active token
        const tokenResult = await db.execute({
            sql: `SELECT id, otp_code FROM deletion_otps WHERE leader_email = ? AND expires_at > ?`,
            args: [email.trim(), currentTime]
        });
        const record = tokenResult.rows[0];

        if (!record) {
            return NextResponse.json({ error: 'Invalid or expired verification pin code.' }, { status: 401 });
        }

        // 2. Evaluate persistent strikes logged against the project
        const projectResult = await db.execute({
            sql: `SELECT security_strikes FROM projects WHERE leader_email = ?`,
            args: [email.trim()]
        });
        const projectRow = projectResult.rows[0];

        if (projectRow && Number(projectRow.security_strikes || 0) >= 3) {
            await db.execute({ sql: 'DELETE FROM deletion_otps WHERE leader_email = ?', args: [email.trim()] });
            return NextResponse.json({ error: 'Security Lockdown: This listing has been permanently locked.' }, { status: 429 });
        }

        // 3. Evaluate verification code match
        if (String(record.otp_code) !== String(otp).trim()) {
            const nextStrikeTotal = Number(projectRow?.security_strikes || 0) + 1;
            
            await db.execute({
                sql: 'UPDATE projects SET security_strikes = ? WHERE leader_email = ?',
                args: [nextStrikeTotal, email.trim()]
            });
            
            if (nextStrikeTotal >= 3) {
                await db.execute({ sql: 'DELETE FROM deletion_otps WHERE leader_email = ?', args: [email.trim()] });
                return NextResponse.json({ error: 'Security Firewall: Listing locked. Token has been burned.' }, { status: 429 });
            }

            const remaining = 3 - nextStrikeTotal;
            return NextResponse.json({ error: `Incorrect PIN. Security lockdown in ${remaining} more attempts.` }, { status: 401 });
        }

        // 4. Executing clearance mutations
        await db.execute({ sql: 'DELETE FROM projects WHERE leader_email = ?', args: [email.trim()] });
        await db.execute({ sql: 'DELETE FROM deletion_otps WHERE leader_email = ?', args: [email.trim()] });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Database processing sequence execution failure.' }, { status: 500 });
    }
}