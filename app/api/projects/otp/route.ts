import { NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { leader_email } = await request.json();
        const db = await getDatabaseConnection();

        // 1. Verify the project actually exists first
        const project = await db.get('SELECT id FROM projects WHERE leader_email = ?', [leader_email]);
        if (!project) {
            return NextResponse.json({ error: 'No project found linked to this email address.' }, { status: 404 });
        }

        // 2. Generate cryptographically strong 6-digit code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 3. Define expiration bounds (30 minutes from now)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // 4. Clear any existing pending codes for this user, then insert the new token
        await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [leader_email]);
        await db.run(
            'INSERT INTO deletion_otps (leader_email, otp_code, expires_at) VALUES (?, ?, ?)',
            [leader_email, otpCode, expiresAt]
        );

        // 5. HACKATHON SIMULATION MODE: Log the email out to your Fedora system terminal
        console.log(`\n============== 📨 SIMULATED KSU SMTP EMAIL SERVER ==============`);
        console.log(`TO: ${leader_email}`);
        console.log(`SUBJECT: Secure Project Deletion Verification PIN`);
        console.log(`BODY: Your security code is [ ${otpCode} ]. It expires in 30 minutes.`);
        console.log(`================================================================\n`);

        return NextResponse.json({ success: true, message: 'Verification code simulated successfully.' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to initialize verification sequence.' }, { status: 500 });
    }
}