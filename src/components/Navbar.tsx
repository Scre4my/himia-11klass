import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          🛍️ Магазин
        </Link>
        <div className="navbar-links">
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
          >
            Каталог
          </Link>
          <Link 
            to="/admin" 
            className={location.pathname === '/admin' ? 'nav-link active' : 'nav-link'}
          >
            Админка
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
