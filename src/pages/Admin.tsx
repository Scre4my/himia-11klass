import React, { useState } from 'react';
import { useProducts } from '../context/ProductContext';
import './Admin.css';

const Admin: React.FC = () => {
  const { addProduct } = useProducts();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: '',
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price) {
      alert('Заполните обязательные поля: Название и Цена');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await addProduct({
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        image: formData.image,
        category: formData.category,
      });

      setSuccessMessage('Товар успешно добавлен!');
      setFormData({
        name: '',
        description: '',
        price: '',
        image: '',
        category: '',
      });

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Ошибка при добавлении товара');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>Админ-панель</h1>
        <p>Добавление нового товара</p>
      </div>

      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="name">Название товара *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Введите название товара"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Описание</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Введите описание товара"
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="price">Цена (₽) *</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Категория</label>
            <input
              type="text"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Например: Электроника"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="image">URL изображения</label>
          <input
            type="url"
            id="image"
            name="image"
            value={formData.image}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Добавление...' : 'Добавить товар'}
        </button>
      </form>
    </div>
  );
};

export default Admin;
