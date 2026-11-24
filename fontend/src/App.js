import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./utils/withAuth";
import LandingPage from "./pages/Landing";
import Authentication from "./pages/authentication";
import Home from "./pages/Home";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import { isValidMeetingCode } from "./utils/meetingCode";

// The meeting bundle (WebRTC, panels) is only loaded when someone actually joins a call
const MeetingPage = lazy(() => import("./meeting/MeetingPage"));

// Old links were /<code> - keep them working
function LegacyMeetingRedirect() {
    const { code } = useParams();
    return isValidMeetingCode(code) ? <Navigate to={`/meet/${code}`} replace /> : <NotFound />;
}

function App() {
    return (
        <ThemeProvider>
        <Router>
            <AuthProvider>
                <ToastProvider>
                    <Suspense fallback={<div className="page-loader"><div className="spinner" /></div>}>
                        <Routes>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/auth" element={<Authentication />} />
                            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                            <Route path="/meet/:code" element={<MeetingPage />} />
                            <Route path="/:code" element={<LegacyMeetingRedirect />} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Suspense>
                </ToastProvider>
            </AuthProvider>
        </Router>
        </ThemeProvider>
    );
}

export default App;
