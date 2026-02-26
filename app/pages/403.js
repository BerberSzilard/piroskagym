
import Link from "next/link";



export default function ForbiddenPage() {

  return (

    <div style={{ maxWidth: 700, margin: "80px auto", fontFamily: "system-ui" }}>

      <h1>403 – Nincs jogosultság</h1>

      <p>Ehhez az oldalhoz admin jogosultság szükséges.</p>

      <p>

        <Link href="/dashboard">Vissza a dashboardra</Link>

      </p>

    </div>

  );

}

