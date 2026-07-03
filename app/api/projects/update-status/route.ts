import { NextResponse } from "next/server";
import { getDatabaseConnection } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { leader_email, otp, newStatus } = body;

        if (!leader_email || !otp || !newStatus) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const db = await getDatabaseConnection();
        const currentTime = new Date().toISOString();

        // 1. Fetch active token parameters by email only
        const record = await db.get(
            `SELECT id, otp_code, attempts FROM deletion_otps WHERE leader_email = ? AND expires_at > ?`,
            [leader_email.trim(), currentTime]
        );
        
        if (!record) {
            return NextResponse.json({ error: 'Invalid or Expired Verification Pin Code' }, { status: 401 });
        }
        
        // 2. CHECK EXISTING LOCKOUTS (If they were already blocked prior)
        if (record.attempts >= 3) {
            await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [leader_email.trim()]);
            return NextResponse.json({ error: 'Security Lockdown: Too many failed attempts. Request a new PIN.' }, { status: 429 });
        }

        // 3. PIN MATCH VERIFICATION
        if (record.otp_code !== otp.trim()) {
            const newAttemptsValue = Number(record.attempts || 0) + 1;
            
            // Sync the updated threat count to SQLite immediately
            await db.run('UPDATE deletion_otps SET attempts = ? WHERE leader_email = ?', [newAttemptsValue, leader_email.trim()]);
            
            // 🛠️ FIXED: If this new value touches or exceeds 3, burn it right now on this exact request!
            if (newAttemptsValue >= 3) {
                await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [leader_email.trim()]);
                return NextResponse.json({ error: 'Security Lockdown: Too many failed attempts. This token has been incinerated.' }, { status: 429 });
            }

            const remaining = 3 - newAttemptsValue;
            return NextResponse.json({ error: `Incorrect PIN. Security lockdown in ${remaining} more attempts.` }, { status: 401 });
        }

        // 4. Verification Confirmed: Execute table mutations
        await db.run('UPDATE projects SET status = ? WHERE leader_email = ?', [newStatus.trim(), leader_email.trim()]);
        await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [leader_email.trim()]);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed To Update Project Post Status' }, { status: 500 });
    }
}