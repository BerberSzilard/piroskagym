import { useRouter } from "next/router";

import Link from "next/link";



import { logout } from "../lib/auth";

import { requireAuth } from "../lib/guards";



export async function getServerSideProps(ctx) {

  const auth = await requireAuth(ctx);

  if (auth.redirect) return auth;



  return {

    props: {

      user: auth.props.user,

      err: auth.props.err,

    },

  };

}



export default function DashboardPage({ user, err }) {

  const router = useRouter();



  function RoleBadge({ role }) {

    const isAdmin = role === "admin";

    return (

      <span

        style={{

          display: "inline-block",

          padding: "2px 8px",

          borderRadius: 999,

          fontSize: 12,

          border: "1px solid #ddd",

          background: isAdmin ? "#ffe6e6" : "#f5f5f5",

        }}

      >

        {role}

      </span>

    );

  }



  function onLogout() {

    logout();

    router.replace("/login");

  }



  if (!user) return null;



  return (

    <div style={{ padding: 24, fontFamily: "system-ui" }}>

      <div

        style={{

          display: "flex",

          alignItems: "center",

          justifyContent: "space-between",

          gap: 12,

          marginBottom: 16,

        }}

      >

        <div>

          <h1 style={{ margin: 0 }}>Dashboard</h1>

          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>

            Belépve: {user.email} · <RoleBadge role={user.role} />

          </div>

        </div>



        <div style={{ display: "flex", gap: 8 }}>

          {user.role === "admin" ? (

            <Link href="/admin" legacyBehavior>

              <a className="btn">Admin felület</a>

            </Link>

          ) : null}



          <button onClick={onLogout} className="btn">

            Kilépés

          </button>

        </div>

      </div>



      {err ? (

        <div style={{ color: "crimson", marginTop: 12 }}>

          Hiba: {err}

        </div>

      ) : null}



      <style jsx>{`

        .btn {

          padding: 8px 12px;

          border: 1px solid #ddd;

          border-radius: 10px;

          background: #fff;



          cursor: pointer;

          font: inherit;

          line-height: 1;

          text-decoration: none;

          color: inherit;



          display: inline-flex;

          align-items: center;

          justify-content: center;

          gap: 6px;



          user-select: none;

        }



        .btn:hover {

          background: #f7f7f7;

        }



        .btn:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }

      `}</style>

    </div>

  );

}

