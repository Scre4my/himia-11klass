import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';
import logo from "../misc/logo.png"

const Navbar: React.FC = () => {
  const location = useLocation();
  const [isAuth, setIsAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuth(!!token);
  }, [location]);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const link = (to: string, label: string) => (
    <Link to={to} className={location.pathname === to ? 'nav-link active' : 'nav-link'}>
      {label}
    </Link>
  );

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img src={logo} alt="" />
          ТехноПар
        </Link>

        <button className={`nav-burger ${menuOpen ? 'nav-burger--open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Меню">
          <span /><span /><span />
        </button>

        <div className={`navbar-links ${menuOpen ? 'navbar-links--open' : ''}`}>
          {link('/', 'Каталог')}
          {link('/calculator', 'Калькулятор')}
          {link('/projects', 'Проекты')}
          {link('/reference', 'Справочник')}
          {isAuth ? link('/admin', 'Админка') : link('/login', 'Вход')}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
