import { Link } from "react-router-dom";
import { useDb } from "./DbProvider";
import PropertyTable from "./PropertyTable";
import "./App.css";

function App() {
  const db = useDb();

  return (
    <div className="app-shell">
      <header>
        <h1>Residential Property Price Register</h1>
        <Link to="/about" className="about-link">
          About
        </Link>
      </header>
      <PropertyTable db={db} />
    </div>
  );
}

export default App;
