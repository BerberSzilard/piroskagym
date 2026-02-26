
import { useEffect, useState } from "react";

import { useRouter } from "next/router";

import { apiFetch, logout } from "../../lib/auth";

import { requireAdmin } from "../../lib/guards";

import Link from "next/link";
import StatusBadge from "../../components/StatusBadge";




export async function getServerSideProps(ctx) {

  const auth = await requireAdmin(ctx);

  if (auth.redirect) return auth;



  return { props: { user: auth.props.user, err: auth.props.err } };

}



export default function AdminPage({ user, err }) {



  const TD_STYLE = { padding: "10px 12px", borderBottom: "1px solid #f0f0f0" };



  function fmtDate(iso) {

  if (!iso) return "";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("hu-HU");

}



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



  const router = useRouter();

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [usersErr, setUsersErr] = useState(null);



  async function reloadUsers() {

  setLoading(true);

  setUsersErr(null);



  try {

    const data = await apiFetch("/api/admin/users");

    setUsers(data?.users || []);

  } catch (e) {

    setUsersErr("Nem sikerült betölteni a felhasználókat.");

  } finally {

    setLoading(false);

  }

}



 // admin: user tiltás / engedélyezés

async function toggleUserDisabled(userId, disabled) {

  return apiFetch(`/api/admin/users/${userId}/disabled`, {

    method: "PATCH",

    body: JSON.stringify({ disabled }),

  });

}



// admin: role váltás

async function updateUserRole(userId, role) {

  return apiFetch(`/api/admin/users/${userId}/role`, {

    method: "PUT",

    body: JSON.stringify({ role }),

  });

}



// admin: kiválasztott user passai + pass lemondás

const [selectedUserId, setSelectedUserId] = useState(null);

const [passes, setPasses] = useState([]);

const [passesLoading, setPassesLoading] = useState(false);

const [passesErr, setPassesErr] = useState(null);



async function loadUserPasses(userId) {

  setSelectedUserId(userId);

  setPassesLoading(true);

  setPassesErr(null);



  try {

    const data = await apiFetch(`/api/admin/users/${userId}/passes`);

    setPasses(data?.passes || data?.user_passes || []);

  } catch (e) {

    setPassesErr("Nem sikerült betölteni a bérleteket.");

  } finally {

    setPassesLoading(false);

  }

}



async function cancelUserPass(passId) {

  return apiFetch(`/api/admin/user-passes/${passId}/cancel`, { method: "POST" });

}

function getPassCardBorder(status) {

  if (status === "active") return "#d4ecd9";

  if (status === "cancelled") return "#f4d2d2";

  return "#e7e7e7";

}



  useEffect(() => {

   reloadUsers();

   // eslint-disable-next-line react-hooks/exhaustive-deps

 }, []);



  function onLogout() {

    logout();

    router.replace("/login");

  }



  // ha valamiért nincs user, ne villogjon semmi

  if (!user) return null;


  if (loading) {

  return <div style={{ padding: 24 }}>Felhasználók betöltése…</div>;

}



if (usersErr) {

  return (

    <div style={{ padding: 24, color: "crimson" }}>

      {usersErr}

    </div>

  );

}



if (!users.length) {

  return <div style={{ padding: 24 }}>Nincs felhasználó.</div>;

}



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

      <h1 style={{ margin: 0 }}>Admin – Felhasználók</h1>

      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>

      Belépve: {user?.email} · <RoleBadge role={user?.role} />

     </div>

    </div>



    <div style={{ display: "flex", gap: 8 }}>

     <Link href="/dashboard" legacyBehavior>

       <a className="btn">Vissza a dashboardra</a>

     </Link>



     <button

       onClick={reloadUsers}

       className="btn"

       disabled={loading}

     >

       {loading ? "Betöltés…" : "Frissítés"}

     </button>



     <button onClick={onLogout} className="btn">

       Kilépés

     </button>

   </div>



   </div>



      {err ? <div style={{ color: "crimson" }}>Hiba: {err}</div> : null}



      <h3>Felhasználók</h3>



      <div className="tableWrap">

      <table

       style={{

       width: "100%",

       borderCollapse: "collapse",

       marginTop: 12,

       border: "1px solid #e5e5e5",

       borderRadius: 12,

       overflow: "hidden",

      }}

     >



        <thead>

          <tr>

            <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e5e5", background: "#fafafa" }}>Email</th>

            <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e5e5", background: "#fafafa" }}>Név</th>

            <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e5e5", background: "#fafafa" }}>Role</th>

            <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e5e5", background: "#fafafa" }}>Létrehozva</th>

            <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e5e5", background: "#fafafa" }}>Műveletek</th>

          </tr>

        </thead>

        <tbody>

          {users.map((u, idx) => (

            <tr key={u.id} className={idx % 2 === 0 ? "row even" : "row odd"}>

             <td style={TD_STYLE}><a href={`mailto:${u.email}`} className="emailLink">{u.email}</a></td>

             <td style={TD_STYLE}>{u.name || "-"}</td>

             <td style={TD_STYLE}><RoleBadge role={u.role} /></td>

             <td style={TD_STYLE}>{fmtDate(u.created_at)}</td>

             <td style={{ whiteSpace: "nowrap" }}>

              <button

    	       className="btn"

               onClick={async () => {

                try {

                 await toggleUserDisabled(u.id, !u.disabled);

                 await reloadUsers();

                 } catch (e) {

                  alert("Nem sikerült a tiltás/engedélyezés.");

                 }

               }}

              >

             {u.disabled ? "Engedélyezés" : "Tiltás"}

            </button>



            <span style={{ display: "inline-block", width: 8 }} />



           <button

            className="btn"

            onClick={async () => {

             try {

              const nextRole = u.role === "admin" ? "user" : "admin";

             await updateUserRole(u.id, nextRole);

             await reloadUsers();

             } catch (e) {

              alert("Nem sikerült a role váltás.");

             }

           }}

          >

          {u.role === "admin" ? "Userré tesz" : "Adminná tesz"}

         </button>



           <span style={{ display: "inline-block", width: 8 }} />



          <button

            className="btn"

            onClick={() => loadUserPasses(u.id)}

           >

            Passok

          </button>

        </td>



            </tr>

          ))}

        </tbody>


      </table>

      </div>



      {selectedUserId && (

       <div style={{ marginTop: 18 }}>

        <h3 style={{ margin: "10px 0" }}>

         Bérletek (user #{selectedUserId})

        </h3>



        {passesLoading && <div>Bérletek betöltése…</div>}

        {passesErr && <div style={{ color: "crimson" }}>{passesErr}</div>}



        {!passesLoading && !passesErr && passes.length === 0 && (

         <div>Nincs bérlet.</div>

        )}



        {!passesLoading && !passesErr && passes.length > 0 && (

         <div style={{ display: "grid", gap: 8 }}>

           {passes.map((p) => {

            const passStatus = p.status === "canceled" ? "cancelled" : p.status;

            return (

         <div

            key={p.id}

            style={{

              border: `1px solid ${getPassCardBorder(passStatus)}` ,

              padding: 12,

              borderRadius: 12,

              background: "#fff",

            }}

          >

            <div

              style={{

                display: "flex",

                justifyContent: "space-between",

                alignItems: "center",

              }}

            >

              <div>

                <div>

                  <b>#{p.id}</b> – {p.pass_type?.name || "Bérlet"} –{" "}

                  <StatusBadge status={passStatus} />

                </div>

              </div>



              <button

                className="btn"

                disabled={passStatus === "cancelled"}

                onClick={async () => {

                  if (!confirm(`Biztosan lemondod? (#${p.id})`)) return;

                  const r = await cancelUserPass(p.id);

                  if (r?.error) return alert(r.error);

                  await loadUserPasses(selectedUserId);

                }}

              >

                Cancel pass

              </button>

            </div>

          </div>

        );

          })}

      </div>

    )}

  </div>

)}



     <style jsx>{`

      .row:hover { background: #f2f7ff; }

      .even { background: #fff; }

      .odd { background: #fafafa; }

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


      .tableWrap {

        width: 100%;

        overflow-x: auto;

      }

      table {

       width: 100%;

       min-width: 980px; /* legyen hely az 5. oszlopnak */

      }


      .emailLink {

        color: inherit;

        text-decoration: none;

      }

      .emailLink:hover {

        text-decoration: underline;

      }

    `}</style>



    </div>

  );

}
