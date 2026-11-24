import { useState } from "react";
import { useNavigate } from "react-router-dom";
import KeyboardOutlinedIcon from "@mui/icons-material/KeyboardOutlined";
import { parseMeetingInput } from "../utils/meetingCode";

export default function JoinForm({ dark = false }) {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const submit = (e) => {
        e.preventDefault();
        const code = parseMeetingInput(value);
        if (!code) {
            setError("Enter a valid meeting code or link");
            return;
        }
        navigate(`/meet/${code}`);
    };

    return (
        <form className={`join-form ${dark ? "join-form-dark" : ""}`} onSubmit={submit} noValidate>
            <div className={`input-icon ${error ? "has-error" : ""}`}>
                <KeyboardOutlinedIcon fontSize="small" />
                <input
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setError("");
                    }}
                    placeholder="Enter a code or link"
                    aria-label="Meeting code or link"
                    aria-invalid={!!error}
                />
            </div>
            <button type="submit" className="btn btn-ghost" disabled={!value.trim()}>
                Join
            </button>
            {error && <div className="field-error join-error">{error}</div>}
        </form>
    );
}
