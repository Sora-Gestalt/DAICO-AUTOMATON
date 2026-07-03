import { NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDatabaseConnection();
        const projects = await db.all('SELECT * FROM projects ORDER BY created_at DESC');
        return NextResponse.json(projects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json(); 
        const {
            title, description, skills_needed, majors_needed, advisor, leader_email, leader_phone, contact_misc
        } = body;

        const db = await getDatabaseConnection();

        const existingProject = await db.get(
            'SELECT id FROM projects WHERE leader_email = ?',
            [leader_email]
        );

        if (existingProject) {
            return NextResponse.json(
                { error: 'This student email has already posted a project.' },
                { status: 400 }
            );
        }

        await db.run(
            `INSERT INTO projects (
                title, description, skills_needed, majors_needed, advisor, leader_email, leader_phone, contact_misc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, skills_needed, majors_needed, advisor, leader_email, leader_phone, contact_misc]
        );

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Database Insertion Failed' }, { status: 500 });
    }
}

// FIX: DELETE is now co-located using URL search params
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const otp = searchParams.get('otp');

        if (!email || !otp) {
            return NextResponse.json({ error: 'Email syntax and OTP string are required.' }, { status: 400 });
        }

        const db = await getDatabaseConnection();
        const currentTime = new Date().toISOString();

        // Query to match the email, pin, and confirm the clock hasn't run out
        const record = await db.get(
            `SELECT id FROM deletion_otps 
             WHERE leader_email = ? AND otp_code = ? AND expires_at > ?`,
            [email, otp, currentTime]
        );

        if (!record) {
            return NextResponse.json({ error: 'Invalid or expired verification pin code.' }, { status: 401 });
        }

        // Execution path is clear: Delete project and scrub the used token record
        await db.run('DELETE FROM projects WHERE leader_email = ?', [email]);
        await db.run('DELETE FROM deletion_otps WHERE leader_email = ?', [email]);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Database verification sequence broken.' }, { status: 500 });
    }
}