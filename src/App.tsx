import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
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
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><SavedProjects /></ProtectedRoute>} />
          <Route path="/reference" element={<ProtectedRoute><ReferenceData /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          <Route path="/steps" element={<ProtectedRoute><StepCalc /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
