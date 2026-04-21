import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import './SavedProjects.css';

interface ProjectRow {
  id: string;
  name: string;
  evaporator_type: string;
  flow_direction: string;
  number_of_effects: number;
  feed_flow_rate: string;
  initial_concentration: string;
  final_concentration: string;
  stages_count: string;
  created_at: string;
  updated_at: string;
}

interface StageResult {
  stageNumber: number;
  temperature: number;
  pressure: number;
  feedFlowRate: number;
  evaporatedWater: number;
  concentrationIn: number;
  concentrationOut: number;
  steamConsumption: number;
  heatExchangeArea: number;
  heatLoad: number;
}

interface ProjectDetail {
  id: string;
  name: string;
  stages: StageResult[];
  totalEvaporatedWater: number;
  totalSteamConsumption: number;
  steamEconomy: number;
  totalHeatExchangeArea: number;
  averageHeatExchangeArea: number;
}

const EVAPORATOR_LABELS: Record<string, string> = {
  'direct-flow': 'Прямоточная',
  'forced-circulation': 'Принудительная циркуляция',
  'film-rising': 'Плёночная (восх.)',
  'film-falling': 'Плёночная (пад.)',
  'vacuum': 'Вакуумная',
};

const FLOW_LABELS: Record<string, string> = {
  'direct': 'Прямоток',
  'counter': 'Противоток',
  'mixed': 'Смешанный',
};

const SavedProjects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return null; }
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, [navigate]);

  const load = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/calculations`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      setProjects(data.calculations || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetail(null);
    setDetailLoading(true);
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_URL}/api/calculations/${id}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetail(data.calculation);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить проект?')) return;
    const headers = authHeaders();
    if (!headers) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_URL}/api/calculations/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Ошибка удаления');
      if (expanded === id) { setExpanded(null); setDetail(null); }
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="sp-container">
      <div className="sp-header">
        <h1>Сохранённые проекты</h1>
        <button className="sp-btn-new" onClick={() => navigate('/calculator')}>+ Новый расчёт</button>
      </div>

      {error && <div className="sp-error">{error}</div>}

      {loading ? (
        <div className="sp-loading">Загрузка...</div>
      ) : projects.length === 0 ? (
        <div className="sp-empty">
          <p>Нет сохранённых проектов</p>
          <button className="sp-btn-new" onClick={() => navigate('/calculator')}>Перейти к калькулятору</button>
        </div>
      ) : (
        <div className="sp-list">
          {projects.map(p => (
            <div key={p.id} className={`sp-card ${expanded === p.id ? 'sp-card--open' : ''}`}>
              <div className="sp-card-header" onClick={() => toggleExpand(p.id)}>
                <div className="sp-card-main">
                  <span className="sp-card-name">{p.name}</span>
                  <div className="sp-card-meta">
                    <span className="sp-badge">{EVAPORATOR_LABELS[p.evaporator_type] || p.evaporator_type}</span>
                    <span className="sp-badge">{FLOW_LABELS[p.flow_direction] || p.flow_direction}</span>
                    <span className="sp-badge sp-badge--blue">{p.number_of_effects} корп.</span>
                  </div>
                </div>
                <div className="sp-card-right">
                  <div className="sp-card-stats">
                    <span>G<sub>н</sub>: {parseFloat(p.feed_flow_rate).toFixed(0)} кг/ч</span>
                    <span>{parseFloat(p.initial_concentration).toFixed(1)}% → {parseFloat(p.final_concentration).toFixed(1)}%</span>
                  </div>
                  <span className="sp-card-date">{fmt(p.created_at)}</span>
                  <div className="sp-card-actions">
                    <button
                      className="sp-btn-delete"
                      onClick={e => handleDelete(p.id, e)}
                      disabled={deleting === p.id}
                    >
                      {deleting === p.id ? '...' : '✕'}
                    </button>
                    <span className={`sp-chevron ${expanded === p.id ? 'sp-chevron--up' : ''}`}>›</span>
                  </div>
                </div>
              </div>

              <div className="sp-card-body">
                {expanded === p.id && (
                  detailLoading ? (
                    <div className="sp-detail-loading">Загрузка...</div>
                  ) : detail && detail.id === p.id ? (
                    <div className="sp-detail">
                      <div className="sp-detail-summary">
                        <div className="sp-stat"><span>Испарено воды</span><strong>{detail.totalEvaporatedWater.toFixed(0)} кг/ч</strong></div>
                        <div className="sp-stat"><span>Расход пара D</span><strong>{detail.totalSteamConsumption.toFixed(0)} кг/ч</strong></div>
                        <div className="sp-stat"><span>Экономичность W/D</span><strong>{detail.steamEconomy.toFixed(3)}</strong></div>
                        <div className="sp-stat"><span>Площадь F общ.</span><strong>{detail.totalHeatExchangeArea.toFixed(1)} м²</strong></div>
                        <div className="sp-stat"><span>Площадь F ср.</span><strong>{detail.averageHeatExchangeArea.toFixed(1)} м²</strong></div>
                      </div>

                      <div className="sp-table-wrap">
                        <table className="sp-table">
                          <thead>
                            <tr>
                              <th>Корп.</th>
                              <th>t кип., °С</th>
                              <th>P, МПа</th>
                              <th>G вх., кг/ч</th>
                              <th>W, кг/ч</th>
                              <th>x вх., %</th>
                              <th>x вых., %</th>
                              <th>D, кг/ч</th>
                              <th>F, м²</th>
                              <th>Q, кВт</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.stages.map(s => (
                              <tr key={s.stageNumber}>
                                <td>{s.stageNumber}</td>
                                <td>{s.temperature.toFixed(1)}</td>
                                <td>{s.pressure.toFixed(4)}</td>
                                <td>{s.feedFlowRate.toFixed(0)}</td>
                                <td>{s.evaporatedWater.toFixed(0)}</td>
                                <td>{s.concentrationIn.toFixed(1)}</td>
                                <td>{s.concentrationOut.toFixed(1)}</td>
                                <td>{s.steamConsumption.toFixed(0)}</td>
                                <td>{s.heatExchangeArea.toFixed(1)}</td>
                                <td>{s.heatLoad.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedProjects;
