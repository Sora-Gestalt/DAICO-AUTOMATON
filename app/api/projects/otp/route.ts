import { NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/db';
import { Resend } from 'resend';
import crypto from 'crypto';

// Initialize Resend with your Vercel Environment Variable
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { leader_email } = await request.json();
        
        // 1. Basic input validation
        if (!leader_email || !leader_email.includes('@')) {
            return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
        }

        const db = await getDatabaseConnection();

        // 2. Verify the project exists using Turso rows array
        const projectResult = await db.execute('SELECT id FROM projects WHERE leader_email = ? LIMIT 1', [leader_email]);
        const project = projectResult.rows[0]; 
        
        if (!project) {
            return NextResponse.json({ error: 'No project found linked to this email address.' }, { status: 404 });
        }

        // 3. RATE LIMITING: Check if an OTP was generated in the last 60 seconds
        const recentOtpResult = await db.execute(
            'SELECT created_at FROM deletion_otps WHERE leader_email = ? ORDER BY created_at DESC LIMIT 1', 
            [leader_email]
        );
        const recentOtp = recentOtpResult.rows[0]; 

        if (recentOtp) {
            // Turso timestamps might return as strings or numbers depending on your schema setup
            const lastCreationTime = new Date(recentOtp.created_at as string | number).getTime();
            const timeElapsed = Date.now() - lastCreationTime;
            
            if (timeElapsed < 60 * 1000) { // 60 seconds cooldown window
                const secondsLeft = Math.ceil((60 * 1000 - timeElapsed) / 1000);
                return NextResponse.json(
                    { error: `Please wait ${secondsLeft} seconds before requesting another code.` }, 
                    { status: 429 } // Too Many Requests
                );
            }
        }

        // 4. SECURITY: Generate a cryptographically strong 6-digit code
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        
        // 5. Define expiration bounds (15 minutes from now)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // 6. Clear existing pending codes for this user, then insert the new token
        await db.execute('DELETE FROM deletion_otps WHERE leader_email = ?', [leader_email]);
        await db.execute(
            'INSERT INTO deletion_otps (leader_email, otp_code, expires_at) VALUES (?, ?, ?)',
            [leader_email, otpCode, expiresAt]
        );

        // 7. Dispatch Email via Resend using your verified domain
        await resend.emails.send({
            from: 'Security <noreply@automaton.buzz>',
            to: [leader_email],
            subject: 'Secure Project Deletion Verification PIN',
            html: `
                <div style="font-family: sans-serif; padding: 20px; max-width: 500px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #333;">Project Deletion Request</h2>
                    <p style="color: #555;">A request was made to delete your project. Use the secure verification code below to authorize this action:</p>
                    <div style="font-size: 28px; font-weight: bold; padding: 15px; background: #f5f5f5; text-align: center; letter-spacing: 4px; border-radius: 4px; margin: 20px 0; color: #000;">
                        ${otpCode}
                    </div>
                    <p style="color: #888; font-size: 12px; margin-top: 20px; line-height: 1.5;">
                        This code will expire in 15 minutes.<br />
                        If you did not initiate this deletion request, please secure your account immediately.
                    </p>
                </div>
            `
        });

        return NextResponse.json({ success: true, message: 'Verification code sent successfully.' });
    } catch (error) {
        console.error('OTP Generation Error:', error);
        return NextResponse.json({ error: 'Failed to initialize verification sequence.' }, { status: 500 });
    }
}