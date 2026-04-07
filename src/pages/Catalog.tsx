import React, { useState } from 'react';
import { useProducts } from '../context/ProductContext';
import './Catalog.css';

const Catalog: React.FC = () => {
  const { products, loading, deleteProduct } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="catalog">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="catalog">
      <div className="catalog-header">
        <h1>Каталог товаров</h1>
      </div>

      <div className="catalog-filters">
        <input
          type="text"
          placeholder="Поиск товаров..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            <option value="">Все категории</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-catalog">
          <p>Товары пока не добавлены</p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              {product.image && (
                <img src={product.image} alt={product.name} className="product-image" />
              )}
              <div className="product-info">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-description">{product.description}</p>
                {product.category && (
                  <span className="product-category">{product.category}</span>
                )}
                <div className="product-footer">
                  <span className="product-price">{product.price} ₽</span>
                  <button 
                    onClick={() => deleteProduct(product.id)}
                    className="delete-btn"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Catalog;
