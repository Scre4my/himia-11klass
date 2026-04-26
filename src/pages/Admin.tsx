import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

import { API_URL as _BASE_URL } from '../config';
const API_URL = _BASE_URL + '/api';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'engineer';
  created_at?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  engineer: 'Инженер',
};

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'engineer' as 'admin' | 'engineer' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { navigate('/login'); return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'admin') { navigate('/calculator'); return; }
    setCurrentUser(u);
  }, [navigate]);

  const fetchUsers = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchUsers();
  }, [currentUser, fetchUsers]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      showError('Заполните логин и пароль');
      return;
    }
    setSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showSuccess(`Пользователь "${data.user.username}" создан`);
      setNewUser({ username: '', password: '', role: 'engineer' });
      await fetchUsers();
    } catch (err: any) {
      showError(err.message || 'Ошибка создания пользователя');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'engineer') => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showSuccess('Роль обновлена');
      await fetchUsers();
    } catch (err: any) {
      showError(err.message || 'Ошибка изменения роли');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="admin">
      <div className="admin-header">
        <div>
          <h1>Управление пользователями</h1>
          <p>Администратор: <strong>{currentUser.username}</strong></p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Выйти</button>
      </div>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <div className="admin-section">
        <h2>Добавить пользователя</h2>
        <form onSubmit={handleAddUser} className="admin-form">
          <div className="form-row">
            <div className="form-group">
              <label>Логин</label>
              <input
                type="text"
                value={newUser.username}
                onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                placeholder="Минимум 3 символа"
              />
            </div>
            <div className="form-group">
              <label>Пароль</label>
              <input
                type="password"
                value={newUser.password}
                onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                placeholder="Минимум 6 символов"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Роль</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser(p => ({ ...p, role: e.target.value as 'admin' | 'engineer' }))}
              className="form-select"
            >
              <option value="engineer">Инженер</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Создание...' : 'Создать пользователя'}
          </button>
        </form>
      </div>

      <div className="admin-section">
        <h2>Список пользователей</h2>
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Логин</th>
                <th>Роль</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={u.id === currentUser.id ? 'current-user-row' : ''}>
                  <td>
                    {u.username}
                    {u.id === currentUser.id && <span className="you-badge">вы</span>}
                  </td>
                  <td>
                    <span className={`role-badge role-badge--${u.role}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td>
                    {u.id !== currentUser.id ? (
                      u.role === 'engineer' ? (
                        <button className="role-btn role-btn--promote" onClick={() => handleChangeRole(u.id, 'admin')}>
                          Сделать администратором
                        </button>
                      ) : (
                        <button className="role-btn role-btn--demote" onClick={() => handleChangeRole(u.id, 'engineer')}>
                          Сделать инженером
                        </button>
                      )
                    ) : (
                      <span className="no-action">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Admin;
