import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalculationInput, CalculationResult } from '../types/Evaporator';
import ResultsTable from '../components/ResultsTable';
import EvaporatorDiagram from '../components/EvaporatorDiagram';
import Charts from '../components/Charts';
import ExportButtons from '../components/ExportButtons';
import './Calculator.css';

import { API_URL } from '../config';

// Значения по умолчанию (пример из методики Дытнерского)
const defaultFormData: CalculationInput = {
  evaporatorType: 'direct-flow',
  flowDirection: 'direct',
  numberOfEffects: 3,
  feedFlowRate: 10000,
  initialConcentration: 10,
  finalConcentration: 50,

  steamPressure: 1.079,          // МПа (~180°C)
  condenserPressure: 0.0147,     // МПа (~55°C)

  heatTransferCoefficients: [2000, 1800, 1600],
  solutionDensities: [1100, 1150, 1200],
  solutionHeatCapacities: [3.8, 3.6, 3.4],
  atmosphericDepressions: [1.5, 2.0, 3.0],

  feedHeatCapacity: 3.9,
  feedAtmosphericDepression: 1.0,

  tubeHeight: 4.0,
  steamFraction: 0.5,
  hydrodynamicDepression: 1.0,
  heatLossFactor: 1.03,
};

const Calculator: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CalculationInput>(defaultFormData);

  /** Обновление скалярного поля */
  const handleChange = (field: keyof CalculationInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /** Обновление элемента массива */
  const handleArrayChange = (field: keyof CalculationInput, index: number, value: number) => {
    setFormData(prev => {
      const arr = [...(prev[field] as number[])];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  /**
   * При изменении числа корпусов — обрезать или дополнить массивы
   */
  const handleEffectsChange = (n: number) => {
    const clamp = (arr: number[], fill: number) => {
      const copy = [...arr];
      while (copy.length < n) copy.push(fill);
      return copy.slice(0, n);
    };
    setFormData(prev => ({
      ...prev,
      numberOfEffects: n,
      heatTransferCoefficients: clamp(prev.heatTransferCoefficients, 1800),
      solutionDensities:        clamp(prev.solutionDensities, 1100),
      solutionHeatCapacities:   clamp(prev.solutionHeatCapacities, 3.8),
      atmosphericDepressions:   clamp(prev.atmosphericDepressions, 1.5),
    }));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    const n = formData.numberOfEffects;

    if (n < 1 || n > 10) errors.push('Количество корпусов: 1–10');
    if (formData.feedFlowRate <= 0) errors.push('Расход раствора должен быть положительным');
    if (formData.initialConcentration <= 0 || formData.initialConcentration >= 100)
      errors.push('Начальная концентрация: 0–100%');
    if (formData.finalConcentration <= 0 || formData.finalConcentration >= 100)
      errors.push('Конечная концентрация: 0–100%');
    if (formData.finalConcentration <= formData.initialConcentration)
      errors.push('Конечная концентрация должна быть больше начальной');
    if (formData.steamPressure <= 0 || formData.steamPressure > 5)
      errors.push('Давление греющего пара: 0–5 МПа');
    if (formData.condenserPressure <= 0 || formData.condenserPressure >= formData.steamPressure)
      errors.push('Давление конденсатора должно быть ниже давления пара');

    return errors;
  };

  const handleCalculate = async () => {
    setError(null);
    setResult(null);

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join('; '));
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }

      const response = await fetch(`${API_URL}/api/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка при расчёте');
      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при расчёте');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    if (!projectName.trim()) { setError('Введите название проекта'); return; }

    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }

      const response = await fetch(`${API_URL}/api/calculations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: projectName, input: formData, result }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка при сохранении');

      setSavedProjectId(data.projectId);
      alert('Проект успешно сохранён!');
      setProjectName('');
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleOptimize = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }

      const response = await fetch(`${API_URL}/api/calculate/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, maxEffects: 6 }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка при оптимизации');

      handleEffectsChange(data.result.optimalNumberOfEffects);
      alert(`Оптимальное количество корпусов: ${data.result.optimalNumberOfEffects}\nПаровая экономичность: ${data.result.steamEconomy.toFixed(2)}`);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при оптимизации');
    } finally {
      setLoading(false);
    }
  };

  const n = formData.numberOfEffects;

  return (
    <div className="calculator-container">
      <h1>Расчёт выпарной батареи</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="calculator-layout">
        {/* ────────── ПАНЕЛЬ ВВОДА ────────── */}
        <div className="input-panel">
          <h2>Входные параметры</h2>
          

          
          {/* ─── Основные параметры ─── */}
          <fieldset className="param-group">
            <legend>Общие параметры</legend>

            <div className="form-group">
              <label>Тип установки:</label>
              <select value={formData.evaporatorType} onChange={e => handleChange('evaporatorType', e.target.value)}>
                <option value="direct-flow">Прямоточная многокорпусная</option>
                <option value="forced-circulation">С принудительной циркуляцией</option>
                <option value="film-rising">Плёночная (восходящая плёнка)</option>
                <option value="film-falling">Плёночная (падающая плёнка)</option>
                <option value="vacuum">Вакуумная</option>
              </select>
            </div>

            <div className="form-group">
              <label>Направление потока:</label>
              <select value={formData.flowDirection} onChange={e => handleChange('flowDirection', e.target.value)}>
                <option value="direct">Прямоточное</option>
                <option value="counter">Противоточное</option>
                <option value="mixed">Смешанное</option>
              </select>
            </div>

            <div className="form-group">
              <label>Количество корпусов:</label>
              <input
                type="number" min="1" max="10"
                value={n}
                onChange={e => handleEffectsChange(parseInt(e.target.value) || 1)}
              />
            </div>
          </fieldset>
          
          {/* ─── Материальный баланс ─── */}
          <fieldset className="param-group">
            <legend>Материальный баланс</legend>

            <div className="form-group">
              <label>Расход исходного раствора G<sub>н</sub>, кг/ч:</label>
              <input type="number" min="1" value={formData.feedFlowRate}
                onChange={e => handleChange('feedFlowRate', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Начальная концентрация x<sub>н</sub>, %:</label>
              <input type="number" min="0.1" max="99.9" step="0.1" value={formData.initialConcentration}
                onChange={e => handleChange('initialConcentration', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Конечная концентрация x<sub>к</sub>, %:</label>
              <input type="number" min="0.1" max="99.9" step="0.1" value={formData.finalConcentration}
                onChange={e => handleChange('finalConcentration', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Теплоёмкость исходного р-ра c<sub>н</sub>, кДж/(кг·К):</label>
              <input type="number" min="0.1" step="0.01" value={formData.feedHeatCapacity}
                onChange={e => handleChange('feedHeatCapacity', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Температурная депрессия исходного р-ра Δ'<sub>н</sub>, °С:</label>
              <input type="number" min="0" step="0.1" value={formData.feedAtmosphericDepression}
                onChange={e => handleChange('feedAtmosphericDepression', parseFloat(e.target.value))} />
            </div>
          </fieldset>

          {/* ─── Давления ─── */}
          <fieldset className="param-group">
            <legend>Давления</legend>

            <div className="form-group">
              <label>Давление греющего пара P<sub>г1</sub>, МПа:</label>
              <input type="number" min="0.01" max="5" step="0.001" value={formData.steamPressure}
                onChange={e => handleChange('steamPressure', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Давление в конденсаторе P<sub>бк</sub>, МПа:</label>
              <input type="number" min="0.001" max="0.5" step="0.001" value={formData.condenserPressure}
                onChange={e => handleChange('condenserPressure', parseFloat(e.target.value))} />
            </div>
          </fieldset>

          {/* ─── Конструктивные параметры ─── */}
          <fieldset className="param-group">
            <legend>Конструктивные параметры</legend>

            <div className="form-group">
              <label>Высота кипятильных труб H, м:</label>
              <input type="number" min="0.5" max="10" step="0.5" value={formData.tubeHeight}
                onChange={e => handleChange('tubeHeight', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Паронаполнение e (0–1):</label>
              <input type="number" min="0" max="1" step="0.05" value={formData.steamFraction}
                onChange={e => handleChange('steamFraction', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Гидродинамическая депрессия Δ''' на корпус, °С:</label>
              <input type="number" min="0" max="5" step="0.1" value={formData.hydrodynamicDepression}
                onChange={e => handleChange('hydrodynamicDepression', parseFloat(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Коэффициент потерь тепла:</label>
              <input type="number" min="1" max="1.2" step="0.01" value={formData.heatLossFactor}
                onChange={e => handleChange('heatLossFactor', parseFloat(e.target.value))} />
            </div>
          </fieldset>

          {/* ─── Параметры по корпусам ─── */}
          <div className='overflow-auto'>
          <fieldset className="param-group">
            <legend>Параметры по корпусам</legend>

            <div className="per-body-table-wrap"><table className="per-body-table">
              <thead>
                <tr>
                  <th>Корпус</th>
                  <th>K, Вт/(м²·К)</th>
                  <th>ρ, кг/м³</th>
                  <th>c<sub>p</sub>, кДж/(кг·К)</th>
                  <th>Δ'<sub>атм</sub>, °С</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: n }, (_, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <input type="number" min="100" max="10000" step="50"
                        value={formData.heatTransferCoefficients[i] ?? 1800}
                        onChange={e => handleArrayChange('heatTransferCoefficients', i, parseFloat(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min="800" max="2000" step="10"
                        value={formData.solutionDensities[i] ?? 1100}
                        onChange={e => handleArrayChange('solutionDensities', i, parseFloat(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min="1" max="5" step="0.1"
                        value={formData.solutionHeatCapacities[i] ?? 3.8}
                        onChange={e => handleArrayChange('solutionHeatCapacities', i, parseFloat(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min="0" max="20" step="0.1"
                        value={formData.atmosphericDepressions[i] ?? 1.5}
                        onChange={e => handleArrayChange('atmosphericDepressions', i, parseFloat(e.target.value))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </fieldset>
           </div>     
          <div className="button-group">
            <button className="btn-primary" onClick={handleCalculate} disabled={loading}>
              {loading ? 'Расчёт...' : 'Рассчитать'}
            </button>
            <button className="btn-secondary" onClick={handleOptimize} disabled={loading}>
              Оптимизировать
            </button>
          </div>
        </div>

        {/* ────────── ПАНЕЛЬ РЕЗУЛЬТАТОВ ────────── */}
        <div className="results-panel">
          {result && (
            <>
              <h2>Результаты расчёта</h2>

              {result.summary && (
                <div className="summary-panel">
                  <h3>Температурные депрессии</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span>Σ Δ' (температурная):</span>
                      <strong>{result.summary.sumDelta_prime.toFixed(2)} °С</strong>
                    </div>
                    <div className="summary-item">
                      <span>Σ Δ'' (гидростатическая):</span>
                      <strong>{result.summary.sumDelta_double.toFixed(2)} °С</strong>
                    </div>
                    <div className="summary-item">
                      <span>Σ Δ''' (гидродинамическая):</span>
                      <strong>{result.summary.sumDelta_triple.toFixed(2)} °С</strong>
                    </div>
                    <div className="summary-item">
                      <span>Σ Δtп (полезная):</span>
                      <strong>{result.summary.sumUsefulDeltaT.toFixed(2)} °С</strong>
                    </div>
                    <div className="summary-item">
                      <span>Температура конденсатора:</span>
                      <strong>{result.summary.condenserTemp.toFixed(1)} °С</strong>
                    </div>
                  </div>
                </div>
              )}

              <EvaporatorDiagram stages={result.stages} />

              <Charts stages={result.stages} />

              <ResultsTable stages={result.stages} />

              <div className="summary-panel">
                <h3>Сводные данные</h3>
                <div className="summary-item">
                  <span>Общее количество испарённой воды:</span>
                  <strong>{result.totalEvaporatedWater.toFixed(2)} кг/ч</strong>
                </div>
                <div className="summary-item">
                  <span>Расход свежего пара D:</span>
                  <strong>{result.totalSteamConsumption.toFixed(2)} кг/ч</strong>
                </div>
                <div className="summary-item">
                  <span>Паровая экономичность W/D:</span>
                  <strong>{result.steamEconomy.toFixed(3)}</strong>
                </div>
                <div className="summary-item">
                  <span>Общая площадь теплообмена:</span>
                  <strong>{result.totalHeatExchangeArea.toFixed(2)} м²</strong>
                </div>
                <div className="summary-item">
                  <span>Средняя площадь теплообмена:</span>
                  <strong>{result.averageHeatExchangeArea.toFixed(2)} м²</strong>
                </div>
              </div>

              <div className="steps-section">
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/steps', { state: { result } })}
                >
                  Промежуточные расчёты
                </button>
              </div>

              <div className="save-section">
                {!savedProjectId ? (
                  <>
                    <div className="form-group">
                      <label>Название проекта:</label>
                      <input
                        type="text"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="Введите название проекта"
                      />
                    </div>
                    <button className="btn-save" onClick={handleSave} disabled={saving || !projectName.trim()}>
                      {saving ? 'Сохранение...' : 'Сохранить проект'}
                    </button>
                  </>
                ) : (
                  <div className="export-section">
                    <p className="success-message">✓ Проект сохранён</p>
                    <ExportButtons calculationId={savedProjectId} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calculator;
