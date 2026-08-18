import { Link } from "react-router-dom";
import "./App.css";

export default function NotFound() {
  return (
    <div className="status-screen">
      <p>Page not found.</p>
      <Link to="/">« Back to home</Link>
    </div>
  );
}
