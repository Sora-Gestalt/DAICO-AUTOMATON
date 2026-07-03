import { NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDatabaseConnection();
        
        // LibSQL uses .execute()
        const result = await db.execute('SELECT * FROM projects ORDER BY created_at DESC');
        
        // Map the rows array directly to match standard JSON objects for the UI
        return NextResponse.json(result.rows);
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

        // Check for existing profile using LibSQL schema matching
        const existingCheck = await db.execute({
            sql: 'SELECT id FROM projects WHERE leader_email = ?',
            args: [leader_email.trim()]
        });

        if (existingCheck.rows.length > 0) {
            return NextResponse.json(
                { error: 'This student email has already posted a project.' },
                { status: 400 }
            );
        }

        await db.execute({
            sql: `INSERT INTO projects (
                title, description, skills_needed, majors_needed, advisor, leader_email, leader_phone, contact_misc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                title.trim(), 
                description.trim(), 
                skills_needed?.trim() || '', 
                majors_needed?.trim() || '', 
                advisor.trim(), 
                leader_email.trim(), 
                leader_phone.trim(), 
                contact_misc?.trim() || ''
            ]
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Database Insertion Failed' }, { status: 500 });
    }
}