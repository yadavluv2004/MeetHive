import React, { useEffect, useState } from 'react';
import "../App.css";
import { Link, useNavigate } from 'react-router-dom';


export default function LandingPage() {
  const router = useNavigate();

  const slideshowImages = [
    "/mobile.png",
    "/mobile2.png",
    "/mobile3.png"
  ];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slideshowImages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className='landingPageContainer'>
      <style>
        {`
          .login-text {
            font-weight: bold;
            display: inline-block;
            border-bottom: 2px solid transparent;
            transition: border-bottom 0.3s ease;
            margin-right: 20px;
          }

          .login-text:hover {
            border-bottom: 2px solid orange;
            color: orange;
            cursor: pointer;
            font-size: 20px;
            transition:0.4s ease-in-out;
          }

          .get-started-btn {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 8px;
            transition: all 0.3s ease;
            text-align: center;
            border: 2px solid transparent;
            margin-top: 20px;
            background-color: white;
          }

          .get-started-btn a {
            text-decoration: none;
            color: #D2042D;
            font-weight: bold;
            display: inline-block;
            width: 100%;
          }

          .get-started-btn:hover {
            background-color: white;
            border: 2px solid #D2042D;
          }

          .get-started-btn:hover a {
            color: #ff9839;
          }

          .slideshow-img {
            width: 100%;
            max-width: 400px;
            transition: opacity 0.5s ease-in-out;
          }

          h2:hover {
            font-size: 80px;
            transition: 0.3s ease-in-out;
          }

          .navItems-desktop {
            display: flex;
            gap: 20px;
          }

          .dropdownMenu {
            display: none;
          }

          @media (max-width: 768px) {
            .slideshow-img {
              display: none;
            }

            .landingMainContainer h1 {
              font-size: 28px !important;
              text-align: center;
            }

            .landingMainContainer p {
              font-size: 20px !important;
              text-align: center;
            }

            .navItems-desktop {
              display: none !important;
            }

            .dropdownMenu {
              display: block !important;
              position: relative;
            }
          }

          .menu-toggle {
            background-color: orange;
            color: white;
            padding: 10px 20px;
            font-weight: bold;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          }

          .dropdown-content {
            position: absolute;
            top: 45px;
            right: 0;
            background-color: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            padding: 10px;
            z-index: 100;
          }

          .dropdown-content .login-text {
            display: block;
            margin: 10px 0;
            font-size: 16px;
            color: black;
            cursor: pointer;
          }
        `}
      </style>

      {/* Navigation */}
      <nav>
        <div className='navHeader'>
          <h2 style={{ cursor: "pointer", fontSize: "40px", fontWeight: "bold" }}>
            <span style={{ color: "orange" }}>Meet</span><span>Hive</span>
          </h2>
        </div>

        <div className='navlist'>
          {/* Desktop Menu */}
          <div className='navItems-desktop'>
            <p className="login-text" onClick={() => router("/aljk23")}>Join as Guest</p>
            <p className="login-text" onClick={() => router("/auth")}>Register</p>
            <p className="login-text" onClick={() => router("/auth")}>Login</p>
          </div>

          {/* Mobile Dropdown Menu */}
          <div className="dropdownMenu">
            <button className="menu-toggle" onClick={() => setDropdownOpen(!dropdownOpen)}>☰ Menu</button>
            {dropdownOpen && (
              <div className="dropdown-content">
                <p className="login-text" onClick={() => { router("/aljk23"); setDropdownOpen(false); }}>Join as Guest</p>
                <p className="login-text" onClick={() => { router("/auth"); setDropdownOpen(false); }}>Register</p>
                <p className="login-text" onClick={() => { router("/auth"); setDropdownOpen(false); }}>Login</p>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="landingMainContainer">
        <div>
          <h1 style={{ fontSize: "50px", marginBottom: "10px" }}>
            <span style={{ color: "#FF9839" }} className="bold">Call</span> .
            <span style={{ color: "#D2042D" }} className="bold">Connect</span>. 
            <span style={{ color: "#5D3FD3" }} className="bold">Cherish</span> with MeetHive
          </h1>
          <p style={{ fontSize: "40px" }}>Feel Closer, Even Miles Apart</p>
          <div className="get-started-btn" role='button'>
            <Link to="/auth">Get Started</Link>
          </div>
        </div>

        <div className='img-div'>
          <img
            src={slideshowImages[currentIndex]}
            alt="Mobile preview"
            className="slideshow-img"
          />
        </div>
       
      </div>

    </div>
  );
}


