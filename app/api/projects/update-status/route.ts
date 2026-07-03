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

        // 1. Fetch active token
        const tokenResult = await db.execute({
            sql: `SELECT id, otp_code FROM deletion_otps WHERE leader_email = ? AND expires_at > ?`,
            args: [leader_email.trim(), currentTime]
        });
        const record = tokenResult.rows[0];
        
        if (!record) {
            return NextResponse.json({ error: 'Invalid or Expired Verification Pin Code' }, { status: 401 });
        }
        
        // 2. Evaluate persistent project profile tracking records
        const projectResult = await db.execute({
            sql: `SELECT security_strikes FROM projects WHERE leader_email = ?`,
            args: [leader_email.trim()]
        });
        const projectRow = projectResult.rows[0];

        if (projectRow && Number(projectRow.security_strikes || 0) >= 3) {
            await db.execute({ sql: 'DELETE FROM deletion_otps WHERE leader_email = ?', args: [leader_email.trim()] });
            return NextResponse.json({ error: 'Security Lockdown: This listing has been permanently locked.' }, { status: 429 });
        }

        // 3. Validation matching parameters
        if (String(record.otp_code) !== String(otp).trim()) {
            const nextStrikeTotal = Number(projectRow?.security_strikes || 0) + 1;
            
            await db.execute({
                sql: 'UPDATE projects SET security_strikes = ? WHERE leader_email = ?',
                args: [nextStrikeTotal, leader_email.trim()]
            });
            
            if (nextStrikeTotal >= 3) {
                await db.execute({ sql: 'DELETE FROM deletion_otps WHERE leader_email = ?', args: [leader_email.trim()] });
                return NextResponse.json({ error: 'Security Firewall: Listing locked. Token has been burned.' }, { status: 429 });
            }

            const remaining = 3 - nextStrikeTotal;
            return NextResponse.json({ error: `Incorrect PIN. Security lockdown in ${remaining} more attempts.` }, { status: 401 });
        }

        // 4. Update status variables
        await db.execute({
            sql: 'UPDATE projects SET status = ? WHERE leader_email = ?',
            args: [newStatus.trim(), leader_email.trim()]
        });
        await db.execute({ sql: 'DELETE FROM deletion_otps WHERE leader_email = ?', args: [leader_email.trim()] });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed To Update Project Post Status' }, { status: 500 });
    }
}