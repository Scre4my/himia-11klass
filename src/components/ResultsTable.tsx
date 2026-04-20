import React from 'react';
import { StageResult } from '../types/Evaporator';
import './ResultsTable.css';

interface ResultsTableProps {
  stages: StageResult[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ stages }) => {
  return (
    <div className="results-table-container">
      <h3>Результаты по корпусам</h3>

      <div className="table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th rowSpan={2}>№</th>
              <th colSpan={2}>Температура, °С</th>
              <th colSpan={2}>Давление, МПа</th>
              <th colSpan={2}>Концентрация, %</th>
              <th rowSpan={2}>W<sub>i</sub>, кг/ч</th>
              <th rowSpan={2}>D<sub>i</sub>, кг/ч</th>
              <th colSpan={3}>Депрессия, °С</th>
              <th rowSpan={2}>Δt<sub>п</sub>, °С</th>
              <th rowSpan={2}>Q, кВт</th>
              <th rowSpan={2}>F, м²</th>
            </tr>
            <tr>
              <th>t<sub>к</sub> (кипение)</th>
              <th>t<sub>г</sub> (пар)</th>
              <th>P<sub>вп</sub></th>
              <th>P<sub>г</sub></th>
              <th>вход</th>
              <th>выход</th>
              <th>Δ'</th>
              <th>Δ''</th>
              <th>Δ'''</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.stageNumber}>
                <td>{s.stageNumber}</td>
                <td>{s.temperature.toFixed(1)}</td>
                <td>{s.heatingTemperature.toFixed(1)}</td>
                <td>{s.pressure.toFixed(4)}</td>
                <td>{s.heatingPressure.toFixed(4)}</td>
                <td>{s.concentrationIn.toFixed(2)}</td>
                <td>{s.concentrationOut.toFixed(2)}</td>
                <td>{s.evaporatedWater.toFixed(1)}</td>
                <td>{s.steamConsumption.toFixed(1)}</td>
                <td>{s.temperatureDepression.toFixed(2)}</td>
                <td>{s.hydrostaticDepression.toFixed(2)}</td>
                <td>{s.hydrodynamicDepression.toFixed(1)}</td>
                <td>{s.usefulDeltaT.toFixed(2)}</td>
                <td>{s.heatLoad.toFixed(1)}</td>
                <td>{s.heatExchangeArea.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
