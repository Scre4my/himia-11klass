import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProductProvider } from './context/ProductContext';
import Navbar from './components/Navbar';
import Catalog from './pages/Catalog';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Calculator from './pages/Calculator';
import ReferenceData from './pages/ReferenceData';
import SavedProjects from './pages/SavedProjects';
import './App.css';

function App() {
  return (
    <ProductProvider>
      <Router>
        <div className="App">
          <Navbar />
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/projects" element={<SavedProjects />} />
            <Route path="/reference" element={<ReferenceData />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </Router>
    </ProductProvider>
  );
}

export default App;
