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
import StepCalc from './pages/StepCalc';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <ProductProvider>
      <Router>
        <div className="App">
          <Navbar />
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><SavedProjects /></ProtectedRoute>} />
            <Route path="/reference" element={<ProtectedRoute><ReferenceData /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/steps" element={<ProtectedRoute><StepCalc /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </ProductProvider>
  );
}

export default App;
