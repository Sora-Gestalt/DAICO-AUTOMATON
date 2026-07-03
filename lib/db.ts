import sqlite3 from "sqlite3";
import {open,Database} from "sqlite";
import path from "path";


const DB_PATH = path.join(process.cwd(),'automaton.db');

let dbInstance:Database | null = null;

export async function getDatabaseConnection(){
    if (dbInstance) return dbInstance;

    dbInstance = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
    });


    await dbInstance.exec(`
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
            status TEXT DEFAULT 'Recruiting', -- New status tracking column
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS deletion_otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            leader_email TEXT NOT NULL,
            otp_code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            attempts INTEGER DEFAULT 0 -- Tracks failed inputs
        );
    `);
    console.log("LOCAL SQLITE CONNECTION ESTABLISHED, GLORY TO MANKIND");
    return dbInstance;
    
}