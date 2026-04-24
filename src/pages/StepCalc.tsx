import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalculationResult, CalcStep } from '../types/Evaporator';
import './StepCalc.css';

const StepCard: React.FC<{ step: CalcStep }> = ({ step }) => (
  <div className="step-card">
    <div className="step-header">
      <span className="step-title">{step.title}</span>
      {step.ref && <span className="step-ref">{step.ref}</span>}
    </div>
    {step.formula && (
      <div className="step-formula">{step.formula}</div>
    )}
    <table className="step-table">
      <thead>
        <tr>
          <th>Параметр</th>
          <th>Подстановка</th>
          <th>Результат</th>
        </tr>
      </thead>
      <tbody>
        {step.rows.map((row, i) => (
          <tr key={i}>
            <td className="step-label">{row.label}</td>
            <td className="step-expr">{row.expr}</td>
            <td className="step-result">{row.result}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StepCalc: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result: CalculationResult | null = (location.state as any)?.result ?? null;

  if (!result) {
    return (
      <div className="stepcalc-empty">
        <p>Нет данных для отображения. Сначала выполните расчёт на странице Калькулятора.</p>
        <button className="btn-primary" onClick={() => navigate('/calculator')}>
          Перейти к калькулятору
        </button>
      </div>
    );
  }

  const steps = result.steps ?? [];

  return (
    <div className="stepcalc-container">
      <div className="stepcalc-nav">
        <button className="btn-back" onClick={() => navigate(-1)}>← Назад</button>
        <h1>Промежуточные расчёты</h1>
        <span className="stepcalc-subtitle">
          Методика Дытнерского · {result.input.numberOfEffects}-корпусная установка
        </span>
      </div>

      <div className="stepcalc-meta">
        <div className="meta-item">
          <span>Расход G_н</span>
          <strong>{result.input.feedFlowRate} кг/ч</strong>
        </div>
        <div className="meta-item">
          <span>Концентрации</span>
          <strong>{result.input.initialConcentration}% → {result.input.finalConcentration}%</strong>
        </div>
        <div className="meta-item">
          <span>Давление греющего пара</span>
          <strong>{result.input.steamPressure} МПа</strong>
        </div>
        <div className="meta-item">
          <span>Давление конденсатора</span>
          <strong>{result.input.condenserPressure} МПа</strong>
        </div>
      </div>

      {steps.length === 0 ? (
        <p className="no-steps">Промежуточные шаги недоступны для данного результата.</p>
      ) : (
        <div className="step-list">
          {steps.map(step => (
            <StepCard key={step.id} step={step} />
          ))}
        </div>
      )}

      <div className="stepcalc-summary">
        <h2>Итоговые значения</h2>
        <table className="step-table">
          <tbody>
            <tr><td>Суммарное испарение W</td><td></td><td>{result.totalEvaporatedWater} кг/ч</td></tr>
            <tr><td>Расход свежего пара D</td><td></td><td>{result.totalSteamConsumption} кг/ч</td></tr>
            <tr><td>Паровая экономичность W/D</td><td></td><td>{result.steamEconomy}</td></tr>
            <tr><td>Общая поверхность теплообмена</td><td></td><td>{result.totalHeatExchangeArea} м²</td></tr>
            <tr><td>Средняя поверхность теплообмена</td><td></td><td>{result.averageHeatExchangeArea} м²</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StepCalc;
