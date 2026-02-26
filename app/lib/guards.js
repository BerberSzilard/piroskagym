
function parseCookie(cookieHeader = "") {

  const out = {};

  cookieHeader.split(";").forEach(part => {

    const [k, ...v] = part.trim().split("=");

    if (!k) return;

    out[k] = decodeURIComponent(v.join("=") || "");

  });

  return out;

}



function getBaseUrl(req) {

  const proto = req.headers["x-forwarded-proto"] || "https";

  const host = req.headers["x-forwarded-host"] || req.headers.host;

  return `${proto}://${host}`;

}



export async function requireAuth(ctx) {

  const { req } = ctx;

  const cookies = parseCookie(req.headers.cookie || "");

  const token = cookies.pg_token;



  if (!token) {

    return { redirect: { destination: "/login", permanent: false } };

  }



  const baseUrl = getBaseUrl(req);

  const meRes = await fetch(`${baseUrl}/api/me`, {

    headers: { Authorization: `Bearer ${token}` },

  });



  if (meRes.status === 401) {

    return { redirect: { destination: "/login", permanent: false } };

  }



  if (meRes.status === 403) {

    return { redirect: { destination: "/403", permanent: false } };

  }



  if (!meRes.ok) {

    return { props: { user: null, err: "http_" + meRes.status } };

  }



  const meData = await meRes.json();

  const user = meData?.user || meData;



  return { props: { user, err: "" }, token };

}



export async function requireAdmin(ctx) {

  const auth = await requireAuth(ctx);



  if (auth.redirect) return auth;

  if (!auth.props?.user) return auth;



  const user = auth.props.user;

  if (user.role !== "admin") {

    return { redirect: { destination: "/403", permanent: false } };

  }



  return auth;

}

