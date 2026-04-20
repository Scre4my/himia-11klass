import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { StageResult } from '../types/Evaporator';
import './Charts.css';

interface ChartsProps {
  stages: StageResult[];
}

const Charts: React.FC<ChartsProps> = ({ stages }) => {
  // Подготовка данных для графиков
  const chartData = stages.map(stage => ({
    name: `Корпус ${stage.stageNumber}`,
    temperature: stage.temperature,
    pressure: stage.pressure,
    steamConsumption: stage.steamConsumption,
    heatExchangeArea: stage.heatExchangeArea,
    evaporatedWater: stage.evaporatedWater
  }));

  return (
    <div className="charts-container">
      <h3>Графическая визуализация</h3>

      <div className="charts-grid">
        {/* График температуры */}
        <div className="chart-card">
          <h4>Температурный профиль</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#ff5722"
                strokeWidth={2}
                name="Температура"
                dot={{ fill: '#ff5722', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* График давления */}
        <div className="chart-card">
          <h4>Профиль давления</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'МПа', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="pressure"
                stroke="#2196f3"
                strokeWidth={2}
                name="Давление"
                dot={{ fill: '#2196f3', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* График расхода пара */}
        <div className="chart-card">
          <h4>Расход пара по корпусам</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'кг/ч', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="steamConsumption"
                fill="#4caf50"
                name="Расход пара"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* График площади теплообмена */}
        <div className="chart-card">
          <h4>Площадь теплообмена</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'м²', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="heatExchangeArea"
                fill="#ff9800"
                name="Площадь теплообмена"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* График испарённой воды */}
        <div className="chart-card">
          <h4>Испарённая вода по корпусам</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'кг/ч', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="evaporatedWater"
                fill="#9c27b0"
                name="Испарённая вода"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Charts;
