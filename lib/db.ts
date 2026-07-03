import { createClient, Client } from "@libsql/client";

let clientInstance: Client | null = null;

export async function getDatabaseConnection() {
    if (clientInstance) return clientInstance;

    // Connects to local file system during dev, switches to Turso cloud automatically on Vercel
    const url = process.env.DATABASE_URL || "file:automaton.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN || "";

    clientInstance = createClient({
        url: url,
        authToken: authToken,
    });

    // Provision the schema matching your local tables
    await clientInstance.execute(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            skills_needed TEXT,
            majors_needed TEXT,
            advisor TEXT NOT NULL,
            leader_email TEXT NOT NULL UNIQUE,
            leader_phone TEXT NOT NULL,
            contact_misc TEXT,
            status TEXT DEFAULT 'Recruiting',
            security_strikes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    await clientInstance.execute(`
        CREATE TABLE IF NOT EXISTS deletion_otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            leader_email TEXT NOT NULL,
            otp_code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            attempts INTEGER DEFAULT 0
        );
    `);

    console.log("⚡ SERVERLESS LIBSQL CONNECTOR ACTIVE");
    return clientInstance;
}