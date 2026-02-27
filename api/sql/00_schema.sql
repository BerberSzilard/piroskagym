-- CI schema bootstrap (minimal for auth smoke)



CREATE TABLE IF NOT EXISTS users (

  id SERIAL PRIMARY KEY,

  email TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,

  password_hash TEXT NOT NULL,

  role TEXT NOT NULL DEFAULT 'user',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);
