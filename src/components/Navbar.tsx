import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';
import logo from "../misc/logo.png"

const Navbar: React.FC = () => {
  const location = useLocation();
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    setIsAuth(!!token);
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
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
          {isAuth && link('/calculator', 'Калькулятор')}
          {isAuth && link('/projects', 'Проекты')}
          {isAuth && link('/reference', 'Справочник')}
          {isAuth && isAdmin && link('/admin', 'Пользователи')}
          {!isAuth && link('/login', 'Вход')}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
