import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log("Tables in 'public' schema:");
  res.rows.forEach(row => console.log(`- ${row.table_name}`));
  await client.end();
}

main().catch(console.error);
