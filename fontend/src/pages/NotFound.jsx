import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import useSeo from "../utils/useSeo";
import "../App.css";

export default function NotFound() {
    const navigate = useNavigate();
    useSeo({ title: "Page not found – MeetHive", noindex: true });
    return (
        <div className="center-page">
            <Logo />
            <h1 className="big-404">404</h1>
            <p className="lead">We couldn't find that page.</p>
            <button className="btn btn-primary" onClick={() => navigate("/")}>Go home</button>
        </div>
    );
}
