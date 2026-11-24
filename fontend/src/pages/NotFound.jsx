import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import "../App.css";

export default function NotFound() {
    const navigate = useNavigate();
    return (
        <div className="center-page">
            <Logo />
            <h1 className="big-404">404</h1>
            <p className="lead">We couldn't find that page.</p>
            <button className="btn btn-primary" onClick={() => navigate("/")}>Go home</button>
        </div>
    );
}
