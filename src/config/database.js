import 'dotenv/config';

//  setting up a serverless PostgreSQL database connection using Neon + Drizzle ORM
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

//  Create the Neon SQL client -- Uses your Postgres connection string
const sql = neon(process.env.DATABASE_URL);
//  Initialize Drizzle with Neon
const db = drizzle(sql);

export { db, sql };
