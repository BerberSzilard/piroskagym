
const express = require("express");

const cors = require("cors");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const { Pool } = require("pg");



const { authRequired } = require("./authMiddleware");



async function expireMyPasses(req, res, next) {

  try {

    // authRequired már lefutott, így req.user.id létezik

    const userId = Number(req.user && req.user.id);

    if (!Number.isFinite(userId)) return next();



    await pool.query(

      `UPDATE user_passes

       SET status = 'expired'

       WHERE user_id = $1

         AND status = 'active'

         AND expires_at <= NOW()`,

      [userId]

    );



    return next();

  } catch (e) {

    console.error("expireMyPasses error:", e);

    return res.status(500).json({ error: "server_error" });

  }

}



const PORT = process.env.PORT || 4000;



function requireRole(role) {

  return (req, res, next) => {

    if (!req.user) return res.status(401).json({ error: "unauthenticated" });

    if (req.user.role !== role) return res.status(403).json({ error: "forbidden" });

    next();

  };

}



// DB config: DATABASE_URL vagy POSTGRES_* alapján

const pool = process.env.DATABASE_URL

  ? new Pool({

      connectionString: process.env.DATABASE_URL,

      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,

    })

  : new Pool({

      host: process.env.POSTGRES_HOST || "db",

      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),

      user: process.env.POSTGRES_USER,

      password: process.env.POSTGRES_PASSWORD,

      database: process.env.POSTGRES_DB,

    });



async function initDb() {

  // minimál users tábla

  await pool.query(`

    CREATE TABLE IF NOT EXISTS users (

      id SERIAL PRIMARY KEY,

      email TEXT UNIQUE NOT NULL,

      name TEXT NOT NULL,

      password_hash TEXT NOT NULL,

      role TEXT NOT NULL DEFAULT 'user',

      created_at TIMESTAMPTZ NOT NULL DEFAULT now()

    );

  `);

}



const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/me", authRequired, expireMyPasses);



// Health

app.get("/api/health", async (req, res) => {

  try {

    await pool.query("select 1 as ok");

    res.json({ status: "ok", db: 1 });

  } catch (e) {

    res.status(500).json({ status: "error", db: 0, message: e.message });

  }

});



// Register

app.post("/api/auth/register", async (req, res) => {

  try {

    const { email, name, password } = req.body || {};

    if (!email || !name || !password) return res.status(400).json({ error: "missing_fields" });



    const existing = await pool.query("select id from users where email=$1", [email]);

    if (existing.rowCount > 0) return res.status(409).json({ error: "email_already_exists" });



    const password_hash = await bcrypt.hash(password, 10);



    const ins = await pool.query(

      "insert into users(email,name,password_hash) values($1,$2,$3) returning id,email,name,role,created_at",

      [email, name, password_hash]

    );



    const user = ins.rows[0];

    const token = jwt.sign(

      { id: user.id, email: user.email, role: user.role, name: user.name },

      process.env.JWT_SECRET,

      { expiresIn: "7d" }

    );



    res.json({ token, user });

  } catch (e) {

    res.status(500).json({ error: "server_error", message: e.message });

  }

});



// Login

app.post("/api/auth/login", async (req, res) => {

  try {

    const { email, password } = req.body || {};

    if (!email || !password) return res.status(400).json({ error: "missing_fields" });



    const q = await pool.query(

     "select id,email,name,role,disabled,password_hash from users where email=$1",

     [email]

    );



   if (q.rowCount === 0) {

     return res.status(401).json({ error: "invalid_credentials" });

   }



   const u = q.rows[0];



   // ⛔ tiltott user ne kapjon tokent

   if (u.disabled) {

     return res.status(403).json({ error: "disabled_user" });

   }



   const ok = await bcrypt.compare(password, u.password_hash);

   if (!ok) {

     return res.status(401).json({ error: "invalid_credentials" });

   }



   const token = jwt.sign(

     { id: u.id, email: u.email, role: u.role, name: u.name },

     process.env.JWT_SECRET,

     { expiresIn: "7d" }

   );



   return res.json({

     token,

     user: { id: u.id, email: u.email, name: u.name, role: u.role }

   });



  } catch (e) {

    res.status(500).json({ error: "server_error", message: e.message });

  }

});



// GET /api/me — bejelentkezett user adatai (DB-ből)

app.get("/api/me", async (req, res) => {

  try {

    const userId = req.user.id;



    const q = await pool.query(

     "select id, email, name, role, disabled from users where id=$1",

     [userId]

    );



    if (q.rowCount === 0) {

     return res.status(404).json({ error: "user_not_found" });

    }



    if (q.rows[0].disabled) {

     return res.status(403).json({ error: "disabled_user" });

    }



    return res.json({ user: q.rows[0] });

  } catch (e) {

    console.error("GET /api/me error:", e);

    return res.status(500).json({ error: "server_error" });

  }

});



app.post("/api/me/passes/purchase", async (req, res) => {

  const userId = req.user.id;



  const passTypeId = Number(req.body?.pass_type_id);

  if (!Number.isInteger(passTypeId) || passTypeId <= 0) {

    return res.status(400).json({ error: "invalid_pass_type_id" });

  }



  const client = await pool.connect();

  try {

    await client.query("BEGIN");



    const pt = await client.query(

      `SELECT id, kind, credits, duration_days, active

       FROM pass_types

       WHERE id = $1`,

      [passTypeId]

    );



    if (pt.rowCount === 0) {

      await client.query("ROLLBACK");

      return res.status(404).json({ error: "pass_type_not_found" });

    }



    const passType = pt.rows[0];



    if (!passType.active) {

      await client.query("ROLLBACK");

      return res.status(400).json({ error: "pass_type_inactive" });

    }



    const durationDays = Number(passType.duration_days);

    if (!Number.isFinite(durationDays) || durationDays <= 0) {

      await client.query("ROLLBACK");

      return res.status(400).json({ error: "invalid_duration_days" });

    }



    let remainingCredits = null;



    if (passType.kind === "pack") {

      const credits = Number(passType.credits);

      if (!Number.isFinite(credits) || credits <= 0) {

        await client.query("ROLLBACK");

        return res.status(400).json({ error: "invalid_pack_credits" });

      }

      remainingCredits = credits;

    }



    if (passType.kind !== "pack" && passType.kind !== "subscription") {

      await client.query("ROLLBACK");

      return res.status(400).json({ error: "invalid_pass_kind" });

    }



        // Prevent duplicate active subscriptions of the same type

    if (passType.kind === "subscription") {

      const existing = await client.query(

        `SELECT id

         FROM user_passes

         WHERE user_id = $1

           AND pass_type_id = $2

           AND status = 'active'

           AND expires_at > NOW()

         LIMIT 1`,

        [userId, passType.id]

      );



      if (existing.rowCount > 0) {

        await client.query("ROLLBACK");

        return res.status(400).json({ error: "already_active_subscription" });

      }

    }



    const inserted = await client.query(

      `INSERT INTO user_passes

        (user_id, pass_type_id, starts_at, expires_at, remaining_credits, status)

       VALUES

        ($1, $2, NOW(), NOW() + ($3 || ' days')::interval, $4, 'active')

       RETURNING id, user_id, pass_type_id, starts_at, expires_at, remaining_credits, status, created_at`,

      [userId, passType.id, String(durationDays), remainingCredits]

    );



    await client.query("COMMIT");



    return res.status(201).json({

      user_pass: inserted.rows[0]

    });



  } catch (e) {

    try { await client.query("ROLLBACK"); } catch (_) {}

    console.error("purchase_pass_error", e);

    return res.status(500).json({ error: "internal_error" });

  } finally {

    client.release();

  }

});



app.get("/api/me/passes", async (req, res) => {

  const userId = req.user.id;



  try {

    const q = await pool.query(

      `SELECT

         up.id,

         up.user_id,

         up.pass_type_id,

         up.starts_at,

         up.expires_at,

         up.remaining_credits,

         up.status,

         up.created_at,



         pt.id          AS pt_id,

         pt.name        AS pt_name,

         pt.kind        AS pt_kind,

         pt.credits     AS pt_credits,

         pt.duration_days AS pt_duration_days,

         pt.is_unlimited AS pt_is_unlimited,

         pt.active      AS pt_active

       FROM user_passes up

       JOIN pass_types pt ON pt.id = up.pass_type_id

       WHERE up.user_id = $1

       ORDER BY up.id DESC`,

      [userId]

    );



    const passes = q.rows.map(r => ({

      id: r.id,

      user_id: r.user_id,

      pass_type_id: r.pass_type_id,

      starts_at: r.starts_at,

      expires_at: r.expires_at,

      remaining_credits: r.remaining_credits,

      status: r.status,

      created_at: r.created_at,

      pass_type: {

        id: r.pt_id,

        name: r.pt_name,

        kind: r.pt_kind,

        credits: r.pt_credits,

        duration_days: r.pt_duration_days,

        is_unlimited: r.pt_is_unlimited,

        active: r.pt_active,

      }

    }));



    return res.status(200).json({ passes });

  } catch (e) {

    console.error("get_my_passes_error", e);

    return res.status(500).json({ error: "internal_error" });

  }

});



app.get("/api/me/passes/active", async (req, res) => {

  const userId = req.user.id;



  try {

    const q = await pool.query(

      `SELECT

         up.id,

         up.user_id,

         up.pass_type_id,

         up.starts_at,

         up.expires_at,

         up.remaining_credits,

         up.status,

         up.created_at,



         pt.id            AS pt_id,

         pt.name          AS pt_name,

         pt.kind          AS pt_kind,

         pt.credits       AS pt_credits,

         pt.duration_days AS pt_duration_days,

         pt.is_unlimited  AS pt_is_unlimited,

         pt.active        AS pt_active

       FROM user_passes up

       JOIN pass_types pt ON pt.id = up.pass_type_id

       WHERE up.user_id = $1

         AND up.status = 'active'

         AND up.expires_at > NOW()

         AND (

           (pt.kind = 'subscription' AND up.remaining_credits IS NULL)

           OR

           (pt.kind = 'pack' AND COALESCE(up.remaining_credits, 0) > 0)

         )

       ORDER BY up.id DESC`,

      [userId]

    );



    const passes = q.rows.map(r => ({

      id: r.id,

      user_id: r.user_id,

      pass_type_id: r.pass_type_id,

      starts_at: r.starts_at,

      expires_at: r.expires_at,

      remaining_credits: r.remaining_credits,

      status: r.status,

      created_at: r.created_at,

      pass_type: {

        id: r.pt_id,

        name: r.pt_name,

        kind: r.pt_kind,

        credits: r.pt_credits,

        duration_days: r.pt_duration_days,

        is_unlimited: r.pt_is_unlimited,

        active: r.pt_active,

      }

    }));



    return res.status(200).json({ passes });

  } catch (e) {

    console.error("get_my_active_passes_error", e);

    return res.status(500).json({ error: "internal_error" });

  }

});



app.get("/api/me/passes/current", async (req, res) => {

  const userId = req.user.id;



  try {

    const q = await pool.query(

      `WITH candidates AS (

         SELECT

           up.id,

           up.user_id,

           up.pass_type_id,

           up.starts_at,

           up.expires_at,

           up.remaining_credits,

           up.status,

           up.created_at,



           pt.id            AS pt_id,

           pt.name          AS pt_name,

           pt.kind          AS pt_kind,

           pt.credits       AS pt_credits,

           pt.duration_days AS pt_duration_days,

           pt.is_unlimited  AS pt_is_unlimited,

           pt.active        AS pt_active,



           CASE

             WHEN pt.kind = 'subscription' THEN 0

             ELSE 1

           END AS kind_priority

         FROM user_passes up

         JOIN pass_types pt ON pt.id = up.pass_type_id

         WHERE up.user_id = $1

           AND up.status = 'active'

           AND up.expires_at > NOW()

           AND (

             (pt.kind = 'subscription' AND up.remaining_credits IS NULL)

             OR

             (pt.kind = 'pack' AND COALESCE(up.remaining_credits, 0) > 0)

           )

       )

       SELECT *

       FROM candidates

       ORDER BY

         kind_priority ASC,                          -- subscription first

         CASE WHEN pt_kind='pack' THEN expires_at END ASC,  -- pack: soonest expiry

         id DESC                                      -- stable tie-break

       LIMIT 1`,

      [userId]

    );



    if (q.rowCount === 0) {

      return res.status(200).json({ user_pass: null });

    }



    const r = q.rows[0];



    const userPass = {

      id: r.id,

      user_id: r.user_id,

      pass_type_id: r.pass_type_id,

      starts_at: r.starts_at,

      expires_at: r.expires_at,

      remaining_credits: r.remaining_credits,

      status: r.status,

      created_at: r.created_at,

      pass_type: {

        id: r.pt_id,

        name: r.pt_name,

        kind: r.pt_kind,

        credits: r.pt_credits,

        duration_days: r.pt_duration_days,

        is_unlimited: r.pt_is_unlimited,

        active: r.pt_active,

      }

    };



    return res.status(200).json({ user_pass: userPass });

  } catch (e) {

    console.error("get_my_current_pass_error", e);

    return res.status(500).json({ error: "internal_error" });

  }

});



/* =========================

   ME – BOOKINGS

   ========================= */



// GET /api/me/bookings

app.get("/api/me/bookings", async (req, res) => {

  try {

    const userId = req.user.id;



    const q = await pool.query(

      `SELECT

         b.id,

         b.status,

         b.created_at,

         cs.id AS class_session_id,

         cs.title,

         cs.description,

         cs.starts_at,

         cs.ends_at,

         cs.location,

         cs.instructor

       FROM bookings b

       JOIN class_sessions cs ON cs.id = b.class_session_id

       WHERE b.user_id = $1

       ORDER BY cs.starts_at DESC`,

      [userId]

    );



    return res.json({ bookings: q.rows });

  } catch (e) {

    console.error("GET /api/me/bookings error:", e);

    return res.status(500).json({ error: "server_error" });

  }

});



/* =========================

   CLASSES – PUBLIC LIST

   ========================= */



app.get("/api/classes", async (req, res) => {

  try {

    const { from, to } = req.query;



    const fromTs = from ? new Date(from) : new Date();

    const toTs = to

      ? new Date(to)

      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);



    const { rows } = await pool.query(

      `SELECT

         id, title, description, starts_at, ends_at,

         capacity, location, instructor, active

       FROM class_sessions

       WHERE active = true

         AND starts_at >= $1

         AND starts_at <= $2

       ORDER BY starts_at ASC`,

      [fromTs.toISOString(), toTs.toISOString()]

    );



    return res.json({ classes: rows });

  } catch (e) {

    console.error("GET /api/classes error:", e);

    return res.status(500).json({ error: "server_error" });

  }

});



/* =========================

   BOOK CLASS (ATOMIC / TX)

   ========================= */



app.post("/api/classes/:id/book", authRequired, async (req, res) => {

  const classId = Number(req.params.id);

  const userId = Number(req.user.id);



  if (!Number.isFinite(classId)) {

    return res.status(400).json({ error: "invalid_class_id" });

  }



  const runOnce = async () => {

    const client = await pool.connect();

    try {

      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");



      const classQ = await client.query(

        "SELECT * FROM class_sessions WHERE id = $1 AND active = true FOR UPDATE",

        [classId]

      );

      if (classQ.rows.length === 0) {

        await client.query("ROLLBACK");

        return { status: 404, body: { error: "class_not_found" } };

      }

      const classRow = classQ.rows[0];



      const cntQ = await client.query(

        "SELECT COUNT(*)::int AS c FROM bookings WHERE class_session_id = $1 AND status = 'booked'",

        [classId]

      );

      if (cntQ.rows[0].c >= classRow.capacity) {

        await client.query("ROLLBACK");

        return { status: 400, body: { error: "class_full" } };

      }



      const requestedPassId =

       req.body && req.body.user_pass_id != null ? Number(req.body.user_pass_id) : null;



      if (req.body && req.body.user_pass_id != null && !Number.isInteger(requestedPassId)) {

        await client.query("ROLLBACK");

        return { status: 400, body: { error: "invalid_user_pass_id" } };

      }



      let passQ;



      if (requestedPassId) {

        // Explicit pass selection: must belong to user and be usable now

        passQ = await client.query(

          `SELECT up.*, pt.kind, pt.is_unlimited

           FROM user_passes up

           JOIN pass_types pt ON pt.id = up.pass_type_id

           WHERE up.id = $1

             AND up.user_id = $2

             AND up.status = 'active'

             AND up.expires_at > NOW()

             AND (

               (pt.kind='subscription' AND up.remaining_credits IS NULL)

               OR

               (pt.kind='pack' AND COALESCE(up.remaining_credits,0) > 0)

             )

           FOR UPDATE`,

          [requestedPassId, userId]

        );

      } else {

        // Auto-select "current" pass: subscription first, else soonest-expiring pack

        passQ = await client.query(

          `WITH candidates AS (

             SELECT

               up.*,

               pt.kind,

               pt.is_unlimited,

               CASE WHEN pt.kind='subscription' THEN 0 ELSE 1 END AS kind_priority

             FROM user_passes up

             JOIN pass_types pt ON pt.id = up.pass_type_id

             WHERE up.user_id = $1

               AND up.status = 'active'

               AND up.expires_at > NOW()

               AND (

                 (pt.kind='subscription' AND up.remaining_credits IS NULL)

                 OR

                 (pt.kind='pack' AND COALESCE(up.remaining_credits,0) > 0)

               )

           )

           SELECT *

           FROM candidates

           ORDER BY

             kind_priority ASC,

             CASE WHEN kind='pack' THEN expires_at END ASC,

             id DESC

           LIMIT 1

           FOR UPDATE`,

          [userId]

        );

      }



      if (passQ.rows.length === 0) {

        await client.query("ROLLBACK");

        return { status: 400, body: { error: "no_active_pass" } };

      }



      const userPass = passQ.rows[0];



       if (userPass.kind === "pack") {

        const dec = await client.query(

          `UPDATE user_passes

           SET remaining_credits = remaining_credits - 1

           WHERE id = $1

             AND COALESCE(remaining_credits, 0) > 0

           RETURNING remaining_credits`,

          [userPass.id]

        );



        if (dec.rowCount === 0) {

          await client.query("ROLLBACK");

          return { status: 400, body: { error: "no_credits" } };

        }

      }



      let bookingRow;

      try {

        const ins = await client.query(

          `INSERT INTO bookings (user_id, class_session_id, user_pass_id)

           VALUES ($1, $2, $3)

           RETURNING *`,

          [userId, classId, userPass.id]

        );

        bookingRow = ins.rows[0];

      } catch (e) {

        if (e && e.code === "23505") {

          await client.query("ROLLBACK");

          return { status: 400, body: { error: "already_booked" } };

        }

        throw e;

      }



      await client.query("COMMIT");

      return { status: 201, body: { booking: bookingRow } };

    } catch (e) {

      try { await client.query("ROLLBACK"); } catch {}

      throw e;

    } finally {

      client.release();

    }

  };



  (async () => {

    try {

      const r1 = await runOnce();

      return res.status(r1.status).json(r1.body);

    } catch (e1) {

      if (e1 && e1.code === "40001") {

        try {

          const r2 = await runOnce();

          return res.status(r2.status).json(r2.body);

        } catch (e2) {

          console.error("POST /api/classes/:id/book error after retry:", e2);

          return res.status(500).json({ error: "server_error" });

        }

      }

      console.error("POST /api/classes/:id/book error:", e1);

      return res.status(500).json({ error: "server_error" });

    }

  })();

});



/* =========================

   CANCEL BOOKING (ATOMIC / TX)

   ========================= */



app.post("/api/bookings/:id/cancel", authRequired, async (req, res) => {

  const bookingId = Number(req.params.id);

  const userId = Number(req.user.id);



  if (!Number.isFinite(bookingId)) {

    return res.status(400).json({ error: "invalid_booking_id" });

  }



  const runOnce = async () => {

    const client = await pool.connect();

    try {

      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");



      // 1) Booking lock + ownership

      const bq = await client.query(

        `SELECT *

         FROM bookings

         WHERE id = $1 AND user_id = $2

         FOR UPDATE`,

        [bookingId, userId]

      );



      if (bq.rows.length === 0) {

        await client.query("ROLLBACK");

        return { status: 404, body: { error: "booking_not_found" } };

      }



      const booking = bq.rows[0];



      if (booking.status === "cancelled") {

        await client.query("ROLLBACK");

        return { status: 400, body: { error: "already_cancelled" } };

      }



      // 2) Állapot frissítés

      await client.query(

        "UPDATE bookings SET status = 'cancelled' WHERE id = $1",

        [bookingId]

      );



      // 3) Kredit visszaadás csak akkor, ha:

      // - van user_pass_id a bookingban

      // - és az a pass pack típus

      if (booking.user_pass_id) {

        const pq = await client.query(

          `SELECT up.id, up.status, up.expires_at, pt.kind

           FROM user_passes up

           JOIN pass_types pt ON pt.id = up.pass_type_id

           WHERE up.id = $1

           FOR UPDATE`,

          [booking.user_pass_id]

        );



        if (pq.rows.length > 0) {

         const pass = pq.rows[0];



        if (pass.kind === "pack") {



         await client.query(

         "UPDATE user_passes SET remaining_credits = COALESCE(remaining_credits, 0) + 1 WHERE id = $1",

         [pass.id]

         );

        }

       }


      }

      await client.query("COMMIT");

      return { status: 200, body: { ok: true } };

    } catch (e) {

      try {

        await client.query("ROLLBACK");

      } catch {}

      throw e;

    } finally {

      client.release();

    }

  };



  (async () => {

    try {

      const r1 = await runOnce();

      return res.status(r1.status).json(r1.body);

    } catch (e1) {

      if (e1 && e1.code === "40001") {

        try {

          const r2 = await runOnce();

          return res.status(r2.status).json(r2.body);

        } catch (e2) {

          console.error("POST /api/bookings/:id/cancel error after retry:", e2);

          return res.status(500).json({ error: "server_error" });

        }

      }

      console.error("POST /api/bookings/:id/cancel error:", e1);

      return res.status(500).json({ error: "server_error" });

    }

  })();

});



app.get("/api/admin/ping", authRequired, requireRole("admin"), (req, res) => {

  res.json({ ok: true, msg: "admin pong" });

});



// GET /api/admin/users – user lista (admin only)

app.get("/api/admin/users", authRequired, requireRole("admin"), async (req, res) => {

  try {

    const q = await pool.query(

      "select id, email, name, role, disabled, created_at from users order by id asc"

    );



    return res.json({ users: q.rows });

  } catch (e) {

    console.error("GET /api/admin/users error:", e);

    return res.status(500).json({ error: "server_error" });

  }

});



/* =========================
   ADMIN – CLASS SESSIONS
   ========================= */

app.get(
  "/api/admin/class-sessions",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT *
         FROM class_sessions
         ORDER BY starts_at ASC`
      );
      res.json(rows);
    } catch (e) {
      console.error("GET /api/admin/class-sessions error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/api/admin/class-sessions",
  authRequired,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        starts_at,
        ends_at,
        capacity,
        location,
        instructor,
      } = req.body;

      if (!title || !starts_at || !ends_at) {
        return res.status(400).json({
          error: "title, starts_at and ends_at are required",
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO class_sessions
         (title, description, starts_at, ends_at, capacity, location, instructor)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          title,
          description || null,
          starts_at,
          ends_at,
          capacity || 10,
          location || null,
          instructor || null,
        ]
      );

      res.status(201).json(rows[0]);
    } catch (e) {
      console.error("POST /api/admin/class-sessions error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);



// PATCH /api/admin/users/:id/disabled – user tiltás / engedélyezés (admin only)

app.patch(

  "/api/admin/users/:id/disabled",

  authRequired,

  requireRole("admin"),

  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const { disabled } = req.body || {};



      if (!Number.isInteger(id) || id <= 0) {

        return res.status(400).json({ error: "invalid_user_id" });

      }



      if (typeof disabled !== "boolean") {

        return res.status(400).json({ error: "invalid_disabled_flag" });

      }



      // admin ne tudja saját magát letiltani

      if (req.user?.id === id && disabled === true) {

        return res.status(400).json({ error: "cannot_disable_self" });

      }



      const q = await pool.query(

        "update users set disabled=$1 where id=$2 returning id, email, name, role, disabled",

        [disabled, id]

      );



      if (q.rowCount === 0) {

        return res.status(404).json({ error: "user_not_found" });

      }



      return res.json({ user: q.rows[0] });

    } catch (e) {

      console.error("PATCH /api/admin/users/:id/disabled error:", e);

      return res.status(500).json({ error: "server_error" });

    }

  }

);



// PUT /api/admin/users/:id/role – role váltás (admin only)

const adminUpdateUserRole = async (req, res) => {

  try {

    const id = Number(req.params.id);

    const { role } = req.body || {};



    if (!Number.isInteger(id) || id <= 0) {

      return res.status(400).json({ error: "invalid_user_id" });

    }



    if (role !== "admin" && role !== "user") {

      return res.status(400).json({ error: "invalid_role" });

    }



    if (req.user?.id === id) {

      return res.status(400).json({ error: "cannot_change_own_role" });

    }



    const result = await pool.query(

      `UPDATE users

       SET role = $1

       WHERE id = $2

       RETURNING id, email, name, role, disabled, created_at`,

      [role, id]

    );



    if (result.rowCount === 0) {

      return res.status(404).json({ error: "user_not_found" });

    }



    return res.json({ ok: true, user: result.rows[0] });

  } catch (err) {

    console.error("admin role update failed", err);

    return res.status(500).json({ error: "server_error" });

  }

};



app.put("/api/admin/users/:id/role", authRequired, requireRole("admin"), adminUpdateUserRole);

app.patch("/api/admin/users/:id/role", authRequired, requireRole("admin"), adminUpdateUserRole);



(async () => {

  try {

    await initDb();

    app.listen(PORT, () => console.log(`API listening on ${PORT}`));

  } catch (e) {

    console.error("DB init failed:", e);

    process.exit(1);

  }

})();



app.get("/api/admin/users/:id/passes", authRequired, requireRole("admin"), async (req, res) => {

  const targetUserId = Number(req.params.id);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {

    return res.status(400).json({ error: "invalid_user_id" });

  }



  try {

    const q = await pool.query(

      `SELECT

         up.id,

         up.user_id,

         up.pass_type_id,

         up.starts_at,

         up.expires_at,

         up.remaining_credits,

         up.status,

         up.created_at,



         pt.id            AS pt_id,

         pt.name          AS pt_name,

         pt.kind          AS pt_kind,

         pt.credits       AS pt_credits,

         pt.duration_days AS pt_duration_days,

         pt.is_unlimited  AS pt_is_unlimited,

         pt.active        AS pt_active

       FROM user_passes up

       JOIN pass_types pt ON pt.id = up.pass_type_id

       WHERE up.user_id = $1

       ORDER BY up.id DESC`,

      [targetUserId]

    );



    const passes = q.rows.map(r => ({

      id: r.id,

      user_id: r.user_id,

      pass_type_id: r.pass_type_id,

      starts_at: r.starts_at,

      expires_at: r.expires_at,

      remaining_credits: r.remaining_credits,

      status: r.status,

      created_at: r.created_at,

      pass_type: {

        id: r.pt_id,

        name: r.pt_name,

        kind: r.pt_kind,

        credits: r.pt_credits,

        duration_days: r.pt_duration_days,

        is_unlimited: r.pt_is_unlimited,

        active: r.pt_active,

      }

    }));



    return res.status(200).json({ passes });

  } catch (e) {

    console.error("GET /api/admin/users/:id/passes error:", e);

    return res.status(500).json({ error: "server_error" });

  }

});



app.post("/api/admin/user-passes/:id/adjust-credits", authRequired, requireRole("admin"), async (req, res) => {

  const userPassId = Number(req.params.id);

  if (!Number.isInteger(userPassId) || userPassId <= 0) {

    return res.status(400).json({ error: "invalid_user_pass_id" });

  }



  const hasDelta = req.body && req.body.delta != null;

  const hasSetTo = req.body && req.body.set_to != null;



  if ((hasDelta && hasSetTo) || (!hasDelta && !hasSetTo)) {

    return res.status(400).json({ error: "provide_delta_or_set_to" });

  }



  const delta = hasDelta ? Number(req.body.delta) : null;

  const setTo = hasSetTo ? Number(req.body.set_to) : null;



  if (hasDelta && (!Number.isFinite(delta) || !Number.isInteger(delta))) {

    return res.status(400).json({ error: "invalid_delta" });

  }

  if (hasSetTo && (!Number.isFinite(setTo) || !Number.isInteger(setTo) || setTo < 0)) {

    return res.status(400).json({ error: "invalid_set_to" });

  }



  const client = await pool.connect();

  try {

    await client.query("BEGIN");



    const upQ = await client.query(

      `SELECT up.*, pt.kind

       FROM user_passes up

       JOIN pass_types pt ON pt.id = up.pass_type_id

       WHERE up.id = $1

       FOR UPDATE`,

      [userPassId]

    );



    if (upQ.rowCount === 0) {

      await client.query("ROLLBACK");

      return res.status(404).json({ error: "user_pass_not_found" });

    }



    const up = upQ.rows[0];



    if (up.kind !== "pack") {

      await client.query("ROLLBACK");

      return res.status(400).json({ error: "not_a_pack_pass" });

    }



    const current = Number(up.remaining_credits || 0);

    let next = current;



    if (hasDelta) next = current + delta;

    if (hasSetTo) next = setTo;



    if (!Number.isInteger(next) || next < 0) {

      await client.query("ROLLBACK");

      return res.status(400).json({ error: "resulting_credits_invalid" });

    }



    const upd = await client.query(

     "UPDATE user_passes SET status = 'cancelled' WHERE id = $1 RETURNING id, status",

     [passId]

    );



    if (upd.rowCount === 0) {

    await client.query("ROLLBACK");

    return res.status(404).json({ error: "pass_not_found" });

    }



    await client.query("COMMIT");

    return res.json({ ok: true, pass: upd.rows[0] });

  } catch (e) {

    try { await client.query("ROLLBACK"); } catch {}

    console.error("POST /api/admin/user-passes/:id/adjust-credits error:", e);

    return res.status(500).json({ error: "server_error" });

  } finally {

    client.release();

  }

});



app.post("/api/admin/user-passes/:id/cancel", authRequired, requireRole("admin"), async (req, res) => {

  const passId = Number(req.params.id);

  if (!Number.isInteger(passId) || passId <= 0) return res.status(400).json({ error: "invalid_pass_id" });



  const client = await pool.connect();

  try {

    await client.query("BEGIN");



    const p = await client.query(

      "SELECT id, status FROM user_passes WHERE id = $1 FOR UPDATE",

      [passId]

    );



    if (p.rowCount === 0) {

      await client.query("ROLLBACK");

      return res.status(404).json({ error: "pass_not_found" });

    }



    if (p.rows[0].status === "cancelled") {

      await client.query("COMMIT");

      return res.json({ ok: true, alreadyCanceled: true });

    }



    const upd = await client.query(

      "UPDATE user_passes SET status = 'cancelled' WHERE id = $1 RETURNING id, status",

      [passId]

    );



    await client.query("COMMIT");

    return res.json({ ok: true, pass: upd.rows[0] });

  } catch (e) {

    try { await client.query("ROLLBACK"); } catch {}

    console.error("POST /api/admin/user-passes/:id/cancel failed", e);

    return res.status(500).json({ error: "server_error" });

  } finally {

    client.release();

  }

});
