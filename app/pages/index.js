
import { useEffect, useState } from "react";



export default function Home() {

  const [health, setHealth] = useState(null);



  useEffect(() => {

    fetch("/api/health")

      .then((r) => r.json())

      .then(setHealth)

      .catch(() => setHealth({ status: "error" }));

  }, []);



  return (

    <main style={{ fontFamily: "system-ui", padding: 24 }}>

      <h1>Piroska Gym – App</h1>

      <p>Next.js frontend + Express backend + PostgreSQL</p>



      <h2>API health</h2>

      <pre style={{ background: "#f3f3f3", padding: 12, borderRadius: 8 }}>

        {health ? JSON.stringify(health, null, 2) : "loading..."}

      </pre>

    </main>

  );

}

