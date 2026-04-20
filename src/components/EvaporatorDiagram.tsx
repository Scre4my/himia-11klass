import React from 'react';
import { StageResult } from '../types/Evaporator';
import './EvaporatorDiagram.css';

interface EvaporatorDiagramProps {
  stages: StageResult[];
}

const EvaporatorDiagram: React.FC<EvaporatorDiagramProps> = ({ stages }) => {
  // Функция для получения цвета по температуре
  const getTemperatureColor = (temp: number): string => {
    if (temp > 100) return '#ff5722'; // Горячий
    if (temp > 70) return '#ff9800';  // Тёплый
    if (temp > 40) return '#ffc107';  // Умеренный
    return '#4caf50';                 // Холодный
  };

  return (
    <div className="evaporator-diagram">
      <h3>Схема батареи выпарных аппаратов</h3>
      
      <div className="diagram-container">
        <div className="stages-container">
          {stages.map((stage, index) => (
            <div key={stage.stageNumber} className="stage-block">
              <div
                className="stage-box"
                style={{
                  backgroundColor: getTemperatureColor(stage.temperature),
                  borderColor: getTemperatureColor(stage.temperature)
                }}
              >
                <div className="stage-header">Корпус {stage.stageNumber}</div>
                <div className="stage-info">
                  <div>T: {stage.temperature.toFixed(1)}°C</div>
                  <div>P: {stage.pressure.toFixed(4)} МПа</div>
                  <div>W: {stage.evaporatedWater.toFixed(1)} кг/ч</div>
                </div>
              </div>
              
              {/* Стрелка между корпусами */}
              {index < stages.length - 1 && (
                <div className="stage-arrow">→</div>
              )}
            </div>
          ))}
        </div>

        {/* Визуальная легенда */}
        <div className="diagram-legend">
          <h4>Легенда температур:</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#ff5722' }}></div>
              <span>&gt;100°C (Горячий)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#ff9800' }}></div>
              <span>70-100°C (Тёплый)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#ffc107' }}></div>
              <span>40-70°C (Умеренный)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#4caf50' }}></div>
              <span>&lt;40°C (Холодный)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaporatorDiagram;
