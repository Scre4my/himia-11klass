import React from 'react';
import { API_URL } from '../config';
import './ExportButtons.css';

interface ExportButtonsProps {
  calculationId: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ calculationId }) => {

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/calculations/${calculationId}/export/${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка при экспорте');
      }

      // Получение файла
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Ошибка экспорта:', err);
      alert('Произошла ошибка при экспорте');
    }
  };

  return (
    <div className="export-buttons">
      <button
        className="export-btn export-btn-pdf"
        onClick={() => handleExport('pdf')}
      >
        📄 Экспорт в PDF
      </button>
      <button
        className="export-btn export-btn-excel"
        onClick={() => handleExport('excel')}
      >
        📊 Экспорт в Excel
      </button>
    </div>
  );
};

export default ExportButtons;
