import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// StrictMode is intentionally not used: in development it mounts components twice,
// which starts/stops/restarts the camera and makes the lobby preview flicker.
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
