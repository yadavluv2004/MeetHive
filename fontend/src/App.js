import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/Landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import VedioMeet from './pages/VedioMeet'; 
import Home from './pages/Home';
import History from './pages/History'; 

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/auth" element={<Authentication />} />
                    <Route path="/home" element={<Home/>}/>
                    <Route path="/history" element={<History/>} />
                    <Route path="/:url" element={<VedioMeet />} /> 
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;


