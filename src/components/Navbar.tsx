import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';
import logo from "../misc/logo.png"

const Navbar: React.FC = () => {
  const location = useLocation();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuth(!!token);
  }, [location]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img src={logo} alt="" />
          ТехноПар
        </Link>
        <div className="navbar-links">
          <Link
            to="/"
            className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
          >
            Каталог
          </Link>
          <Link
            to="/calculator"
            className={location.pathname === '/calculator' ? 'nav-link active' : 'nav-link'}
          >
            Калькулятор
          </Link>
          <Link
            to="/projects"
            className={location.pathname === '/projects' ? 'nav-link active' : 'nav-link'}
          >
            Проекты
          </Link>
          <Link
            to="/reference"
            className={location.pathname === '/reference' ? 'nav-link active' : 'nav-link'}
          >
            Справочник
          </Link>
          {isAuth ? (
            <Link
              to="/admin"
              className={location.pathname === '/admin' ? 'nav-link active' : 'nav-link'}
            >
              Админка
            </Link>
          ) : (
            <Link
              to="/login"
              className={location.pathname === '/login' ? 'nav-link active' : 'nav-link'}
            >
              Вход
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
