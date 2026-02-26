/* =========================

   DOMAIN CORE TABLES

   ========================= */



BEGIN;



/* --------

   Class sessions (órák)

   -------- */

CREATE TABLE IF NOT EXISTS class_sessions (

    id SERIAL PRIMARY KEY,

    title TEXT NOT NULL,

    description TEXT,

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ NOT NULL,

    capacity INT NOT NULL DEFAULT 10,

    location TEXT,

    instructor TEXT,

    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);



/* --------

   Bookings (foglalások)

   -------- */

CREATE TABLE IF NOT EXISTS bookings (

    id SERIAL PRIMARY KEY,

    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    class_session_id INT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'booked',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, class_session_id)

);



/* --------

   Pass types (bérlet típusok)

   -------- */

CREATE TABLE IF NOT EXISTS pass_types (

    id SERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    kind TEXT NOT NULL CHECK (kind IN ('pack', 'subscription')),

    credits INT,

    duration_days INT NOT NULL,

    is_unlimited BOOLEAN NOT NULL DEFAULT false,

    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (

        (kind = 'pack' AND credits IS NOT NULL AND credits > 0)

        OR

        (kind = 'subscription' AND credits IS NULL)

    )

);



/* --------

   User passes (felhasználó bérletei)

   -------- */

CREATE TABLE IF NOT EXISTS user_passes (

    id SERIAL PRIMARY KEY,

    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    pass_type_id INT NOT NULL REFERENCES pass_types(id),

    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    expires_at TIMESTAMPTZ NOT NULL,

    remaining_credits INT,

    status TEXT NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);



COMMIT;
