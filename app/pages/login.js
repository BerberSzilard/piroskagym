
import { useState } from "react";

import { useRouter } from "next/router";

import { login } from "../lib/auth";



export default function LoginPage() {

  const router = useRouter();



  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);



  async function handleSubmit(e) {

  e.preventDefault();



  setError("");

  setLoading(true);



  try {

    const user = await login(email, password);



    // ✅ role alapú redirect

    if (user?.role === "admin") {

      router.replace("/admin");

    } else {

      router.replace("/dashboard");

    }



  } catch (err) {

    setError("Hibás email vagy jelszó");

  } finally {

    setLoading(false);

  }

}



  return (

    <div style={{ maxWidth: 400, margin: "80px auto", fontFamily: "system-ui" }}>

      <h1>Bejelentkezés</h1>



      <form onSubmit={handleSubmit}>

        <input

          placeholder="Email"

          type="email"

          value={email}

          onChange={e => setEmail(e.target.value)}

          required

          style={{ width: "100%", padding: 10, marginBottom: 10 }}

        />



        <input

          placeholder="Jelszó"

          type="password"

          value={password}

          onChange={e => setPassword(e.target.value)}

          required

          style={{ width: "100%", padding: 10, marginBottom: 10 }}

        />



        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}



        <button disabled={loading} style={{ padding: 10, width: "100%" }}>

          {loading ? "Belépés..." : "Belépés"}

        </button>

      </form>

    </div>

  );

}
