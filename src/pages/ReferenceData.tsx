import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import './ReferenceData.css';

import { API_URL } from '../config';

interface ReferenceTable {
  id: string;
  name: string;
  headers: string[];
  rows: string[][];
  group_id: string | null;
  group_name?: string;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Редактируемая ячейка
// ──────────────────────────────────────────────────────────────────
const Cell: React.FC<{
  value: string;
  isHeader?: boolean;
  onChange: (val: string) => void;
}> = ({ value, isHeader, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        className="cell-input"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
    );
  }

  return (
    <div
      className={isHeader ? 'cell-header-val' : 'cell-value'}
      onDoubleClick={() => setEditing(true)}
      title="Двойной клик — редактировать"
    >
      {value || <span className="cell-empty">—</span>}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Полная таблица с фильтром и редактированием
// ──────────────────────────────────────────────────────────────────
const EditableTable: React.FC<{
  table: ReferenceTable;
  onSave: (t: ReferenceTable) => Promise<void>;
  onDelete: (id: string) => void;
}> = ({ table, onSave, onDelete }) => {
  const [name, setName]       = useState(() => table.name);
  const [headers, setHeaders] = useState<string[]>(() => table.headers);
  const [rows, setRows]       = useState<string[][]>(() => table.rows);
  const [filters, setFilters] = useState<string[]>(() => table.headers.map(() => ''));
  const [dirty, setDirty]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setName(table.name);
    setHeaders(table.headers);
    setRows(table.rows);
    setFilters(table.headers.map(() => ''));
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  useEffect(() => {
    if (!dirty) setName(table.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.name]);

  const mark = () => setDirty(true);

  const updateHeader = (i: number, v: string) => { const h = [...headers]; h[i] = v; setHeaders(h); mark(); };
  const updateCell   = (r: number, c: number, v: string) => {
    const next = rows.map(row => [...row]); next[r][c] = v; setRows(next); mark();
  };

  const addRow = () => { setRows(p => [...p, Array(headers.length).fill('')]); mark(); };
  const delRow = (r: number) => { setRows(p => p.filter((_, i) => i !== r)); mark(); };

  const addCol = () => {
    const label = `Столбец ${headers.length + 1}`;
    setHeaders(p => [...p, label]);
    setRows(p => p.map(row => [...row, '']));
    setFilters(p => [...p, '']);
    mark();
  };
  const delCol = (c: number) => {
    setHeaders(p => p.filter((_, i) => i !== c));
    setRows(p => p.map(row => row.filter((_, i) => i !== c)));
    setFilters(p => p.filter((_, i) => i !== c));
    mark();
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...table, name, headers, rows });
    setSaving(false);
    setDirty(false);
  };

  // Excel-экспорт
  const exportExcel = () => {
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Ширина столбцов по содержимому
    const colWidths = headers.map((h, ci) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map(row => (row[ci] || '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Таблица');
    XLSX.writeFile(wb, `${name || 'таблица'}.xlsx`);
  };

  // Фильтрация
  const filtered = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) =>
      filters.every((f, ci) =>
        !f.trim() || String(row[ci] ?? '').toLowerCase().includes(f.toLowerCase())
      )
    );

  const hasFilter = filters.some(f => f.trim());

  return (
    <div className="rt-card">
      {/* Шапка карточки */}
      <div className="rt-card-header" onClick={() => setCollapsed(c => !c)}>
        <input
          className="rt-name-input"
          value={name}
          onClick={e => e.stopPropagation()}
          onChange={e => { setName(e.target.value); mark(); }}
        />
        <div className="rt-card-actions" onClick={e => e.stopPropagation()}>
          {dirty && (
            <button className="btn-sm btn-blue" disabled={saving} onClick={handleSave}>
              {saving ? 'Сохранение...' : '💾 Сохранить'}
            </button>
          )}
          <button className="btn-sm btn-green" onClick={exportExcel} title="Экспорт в Excel">
            ⬇ Excel
          </button>
          <button className="btn-sm btn-red" onClick={() => {
            if (window.confirm(`Удалить таблицу «${name}»?`)) onDelete(table.id);
          }}>
            🗑 Удалить
          </button>
          <span className={`collapse-arrow${collapsed ? ' collapsed' : ''}`}>▲</span>
        </div>
      </div>

      <div className={`rt-collapsible${collapsed ? '' : ' rt-collapsible-open'}`}>
        <div className="rt-card-body">
          {/* Строка фильтров */}
          <div className="filter-bar">
            <span className="filter-label">Фильтр:</span>
            <div className="filter-inputs">
              {headers.map((_, ci) => (
                <input
                  key={ci}
                  className="filter-inp"
                  placeholder={headers[ci] || `Стб ${ci + 1}`}
                  value={filters[ci]}
                  onChange={e => { const f = [...filters]; f[ci] = e.target.value; setFilters(f); }}
                />
              ))}
            </div>
            {hasFilter && (
              <button className="btn-clear-f" onClick={() => setFilters(headers.map(() => ''))}>
                Сбросить
              </button>
            )}
          </div>

          {hasFilter && (
            <div className="filter-count">
              Показано {filtered.length} из {rows.length} строк
            </div>
          )}

          {/* Таблица */}
          <div className="tbl-scroll">
            <table className="etable">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  {headers.map((h, ci) => (
                    <th key={ci}>
                      <div className="th-inner">
                        <Cell value={h} isHeader onChange={v => updateHeader(ci, v)} />
                        <button className="btn-del-col" onClick={() => delCol(ci)} title="Удалить столбец">×</button>
                      </div>
                    </th>
                  ))}
                  <th className="col-act">
                    <button className="btn-add-col" onClick={addCol} title="Добавить столбец">+</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={headers.length + 2} className="no-data">Нет строк</td></tr>
                ) : filtered.map(({ row, idx }) => (
                  <tr key={idx}>
                    <td className="col-num-val">{idx + 1}</td>
                    {row.map((val, ci) => (
                      <td key={ci}><Cell value={val} onChange={v => updateCell(idx, ci, v)} /></td>
                    ))}
                    <td className="col-act">
                      <button className="btn-del-row" onClick={() => delRow(idx)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-add-row" onClick={addRow}>+ Добавить строку</button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Группа таблиц (несколько листов из одного файла) с вкладками
// ──────────────────────────────────────────────────────────────────
const TableGroup: React.FC<{
  tables: ReferenceTable[];
  onSave: (t: ReferenceTable) => Promise<void>;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
}> = ({ tables, onSave, onDelete, onDeleteGroup }) => {
  const [activeId, setActiveId] = useState(tables[0]?.id ?? '');
  const [collapsed, setCollapsed] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const activeTable = tables.find(t => t.id === activeId) ?? tables[0];
  const groupId = tables[0]?.group_id ?? '';

  useEffect(() => {
    if (!nameDirty) {
      setGroupName(tables[0]?.group_name || '');
    }
  }, [tables[0]?.group_name]);
  const token = () => localStorage.getItem('token');

  const saveGroupName = async (name: string) => {
    if (!name.trim() || !groupId) return;
    try {
      await fetch(`${API_URL}/api/reference/tables/group/${groupId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ group_name: name.trim() })
      });
      setNameDirty(false);
    } catch {}
  };

  const exportGroupExcel = () => {
    const wb = XLSX.utils.book_new();
    tables.forEach(t => {
      const data = [t.headers, ...t.rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = t.headers.map((h, ci) => ({
        wch: Math.min(Math.max(h.length, ...t.rows.map(r => (r[ci] || '').length), 8) + 2, 40)
      }));
      XLSX.utils.book_append_sheet(wb, ws, t.name.replace(/[\\/:*?[\]]/g, '').slice(0, 31) || 'Лист');
    });
    XLSX.writeFile(wb, `${groupName}.xlsx`);
  };

  return (
    <div className="table-group-card">
      <div className="tg-group-header" onClick={() => setCollapsed(c => !c)}>
        <input
          className="tg-group-name-input"
          value={groupName}
          placeholder="Название группы"
          onClick={e => e.stopPropagation()}
          onChange={e => { setGroupName(e.target.value); setNameDirty(true); }}
          onBlur={e => { if (nameDirty) saveGroupName(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        <div className="tg-group-actions" onClick={e => e.stopPropagation()}>
          <button className="btn-sm btn-green" onClick={exportGroupExcel} title="Экспорт всех листов">
            ⬇ Excel
          </button>
          <button
            className="btn-sm btn-red"
            onClick={() => {
              if (window.confirm(`Удалить группу «${groupName}» (${tables.length} листов)?`))
                onDeleteGroup(tables.map(t => t.id));
            }}
            title="Удалить всю группу"
          >
            🗑 Удалить
          </button>
        </div>
        <span className={`tg-collapse-arrow${collapsed ? ' collapsed' : ''}`}>▲</span>
      </div>
      <div className={`tg-collapsible${collapsed ? '' : ' tg-collapsible-open'}`}>
        <div className="tg-collapsible-inner">
          <div className="tg-tabs">
            {tables.map(t => (
              <button
                key={t.id}
                className={`tg-tab${t.id === activeId ? ' tg-tab-active' : ''}`}
                onClick={() => setActiveId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {activeTable && (
            <div className="tg-body">
              <EditableTable
                key={activeTable.id}
                table={activeTable}
                onSave={onSave}
                onDelete={(id) => {
                  onDelete(id);
                  if (id === activeId) {
                    const remaining = tables.filter(t => t.id !== id);
                    if (remaining.length > 0) setActiveId(remaining[0].id);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Диалог создания новой таблицы
// ──────────────────────────────────────────────────────────────────
const CreateDialog: React.FC<{
  onConfirm: (name: string, cols: number, rows: number) => void;
  onClose: () => void;
}> = ({ onConfirm, onClose }) => {
  const [name, setName] = useState('Новая таблица');
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(10);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Создать таблицу</h3>

        <div className="dialog-field">
          <label>Название</label>
          <input
            className="dialog-input"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="dialog-row">
          <div className="dialog-field">
            <label>Столбцов</label>
            <input
              className="dialog-input small"
              type="number"
              min={1}
              max={30}
              value={cols}
              onChange={e => setCols(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="dialog-field">
            <label>Строк</label>
            <input
              className="dialog-input small"
              type="number"
              min={1}
              max={500}
              value={rows}
              onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        <div className="dialog-actions">
          <button
            className="btn-sm btn-blue"
            onClick={() => { if (name.trim()) onConfirm(name.trim(), cols, rows); }}
            disabled={!name.trim()}
          >
            Создать
          </button>
          <button className="btn-sm btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Диалог предпросмотра импорта
// ──────────────────────────────────────────────────────────────────
interface ImportPreview {
  fileName: string;
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  rows: string[][];
  name: string;
}

const ImportDialog: React.FC<{
  preview: ImportPreview;
  onChange: (p: ImportPreview) => void;
  onConfirm: () => void;
  onConfirmAll: () => void;
  onClose: () => void;
  wb: XLSX.WorkBook;
}> = ({ preview, onChange, onConfirm, onConfirmAll, onClose, wb }) => {
  const [sheetsOpen, setSheetsOpen] = useState(false);

  const switchSheet = (sheet: string) => {
    const ws = wb.Sheets[sheet];
    const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
    const normalized = raw.map(r => r.map(c => String(c ?? '')));
    const headers = normalized[0] ?? [];
    const rows    = normalized.slice(1).filter(r => r.some(c => c !== ''));
    onChange({ ...preview, selectedSheet: sheet, headers, rows });
  };

  const totalRows = preview.rows.length;
  const totalCols = preview.headers.length;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog import-dialog" onClick={e => e.stopPropagation()}>
        <h3>Импорт из Excel</h3>
        <p className="import-file-name">📄 {preview.fileName}</p>

        <div className="dialog-field">
          <label>Название таблицы</label>
          <input
            className="dialog-input"
            value={preview.name}
            onChange={e => onChange({ ...preview, name: e.target.value })}
          />
        </div>

        {preview.sheets.length > 1 && (
          <div className="import-sheets-field">
            <button
              className="sheets-dropdown-trigger"
              onClick={() => setSheetsOpen(o => !o)}
            >
              <span>Листы ({preview.sheets.length})</span>
              <span className="sheets-dropdown-active">
                {preview.selectedSheet}
              </span>
              <span className={`sheets-dropdown-arrow${sheetsOpen ? ' open' : ''}`}>▾</span>
            </button>
            {sheetsOpen && (
              <div className="sheet-tabs">
                {preview.sheets.map(s => (
                  <button
                    key={s}
                    className={`sheet-tab ${preview.selectedSheet === s ? 'active' : ''}`}
                    onClick={() => { switchSheet(s); setSheetsOpen(false); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="import-stats">
          {totalCols} столбцов · {totalRows} строк данных
        </div>

        {/* Мини-предпросмотр — первые 5 строк */}
        <div className="import-preview-wrap">
          <table className="import-preview-tbl">
            <thead>
              <tr>
                {preview.headers.map((h, i) => <th key={i}>{h || `—`}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 5).map((row, ri) => (
                <tr key={ri}>
                  {row.map((v, ci) => <td key={ci}>{v}</td>)}
                </tr>
              ))}
              {totalRows > 5 && (
                <tr>
                  <td colSpan={totalCols} className="import-more">
                    ... ещё {totalRows - 5} строк
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dialog-actions">
          <button className="btn-sm btn-blue" onClick={onConfirm} disabled={!preview.name.trim()}>
            Импортировать этот лист
          </button>
          {preview.sheets.length > 1 && (
            <button className="btn-sm btn-teal" onClick={onConfirmAll}>
              ⬆ Импортировать все листы ({preview.sheets.length})
            </button>
          )}
          <button className="btn-sm btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Главная страница
// ──────────────────────────────────────────────────────────────────
const ReferenceData: React.FC = () => {
  const navigate = useNavigate();
  const [tables, setTables]       = useState<ReferenceTable[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importWb, setImportWb]   = useState<XLSX.WorkBook | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const token = () => localStorage.getItem('token');

  const requireAuth = useCallback(() => {
    if (!token()) { navigate('/login'); return false; }
    return true;
  }, [navigate]);

  // Загрузка
  const loadTables = useCallback(async () => {
    if (!requireAuth()) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/reference/tables`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await r.json();
      if (r.ok) setTables(data.tables || []);
      else setError(data.error);
    } catch { setError('Сервер недоступен'); }
    finally { setLoading(false); }
  }, [requireAuth]);

  useEffect(() => { loadTables(); }, [loadTables]);

  // Создать новую таблицу
  const handleCreate = async (name: string, cols: number, rowCount: number) => {
    if (!requireAuth()) return;

    const headers = Array.from({ length: cols }, (_, i) => `Столбец ${i + 1}`);
    const rows    = Array.from({ length: rowCount }, () => Array(cols).fill(''));

    try {
      const r = await fetch(`${API_URL}/api/reference/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name, headers, rows })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setShowCreate(false);
      setTables(prev => [data.table, ...prev]);
    } catch (e: any) { setError(e.message); }
  };

  // Сохранить изменения
  const handleSave = async (t: ReferenceTable) => {
    if (!requireAuth()) return;
    try {
      const r = await fetch(`${API_URL}/api/reference/tables/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: t.name, headers: t.headers, rows: t.rows })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTables(prev => prev.map(x => x.id === t.id ? data.table : x));
    } catch (e: any) { setError(e.message); }
  };

  // Удалить всю группу
  const handleDeleteGroup = async (ids: string[]) => {
    if (!requireAuth()) return;
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API_URL}/api/reference/tables/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token()}` }
        })
      ));
      setTables(prev => prev.filter(t => !ids.includes(t.id)));
    } catch (e: any) { setError(e.message); }
  };

  // Удалить
  const handleDelete = async (id: string) => {
    if (!requireAuth()) return;
    try {
      const r = await fetch(`${API_URL}/api/reference/tables/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!r.ok) throw new Error('Ошибка удаления');
      setTables(prev => prev.filter(t => t.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  // Импорт из Excel
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
        const normalized = raw.map(r => r.map(c => String(c ?? '')));

        // Отбрасываем полностью пустые строки
        const nonempty = normalized.filter(r => r.some(c => c !== ''));
        if (nonempty.length === 0) { setError('Файл пустой или не содержит данных'); return; }

        const headers = nonempty[0];
        const rows    = nonempty.slice(1);

        // Нормализуем количество столбцов по максимуму
        const maxCols = Math.max(headers.length, ...rows.map(r => r.length));
        const pad = (r: string[]) => { const a = [...r]; while (a.length < maxCols) a.push(''); return a; };

        const fileBaseName = file.name.replace(/\.[^.]+$/, '');
        setImportWb(wb);
        setImportPreview({
          fileName: file.name,
          sheets: wb.SheetNames,
          selectedSheet: sheetName,
          headers: pad(headers),
          rows: rows.map(pad),
          name: fileBaseName,
        });
      } catch {
        setError('Не удалось прочитать файл. Убедитесь, что это корректный Excel (.xlsx/.xls) или CSV.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportConfirm = async () => {
    if (!importPreview || !requireAuth()) return;
    const { name, headers, rows } = importPreview;
    setImportPreview(null);
    setImportWb(null);
    try {
      const r = await fetch(`${API_URL}/api/reference/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: name.trim(), headers, rows })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTables(prev => [data.table, ...prev]);
    } catch (e: any) { setError(e.message); }
  };

  const handleImportAllConfirm = async () => {
    if (!importPreview || !importWb || !requireAuth()) return;
    const fileName = importPreview.fileName;
    const groupName = importPreview.name.trim() || fileName.replace(/\.[^.]+$/, '');
    const groupId = `${fileName}-${Date.now()}`;

    const tablesData = importWb.SheetNames.map(sheetName => {
      const ws = importWb.Sheets[sheetName];
      const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
      const normalized = raw.map(r => r.map(c => String(c ?? '')));
      const nonempty = normalized.filter(r => r.some(c => c !== ''));
      if (nonempty.length === 0) return null;
      const headers = nonempty[0];
      const rows = nonempty.slice(1);
      const maxCols = Math.max(headers.length, ...rows.map(r => r.length));
      const pad = (row: string[]) => { const a = [...row]; while (a.length < maxCols) a.push(''); return a; };
      return { name: sheetName, headers: pad(headers), rows: rows.map(pad) };
    }).filter(Boolean) as { name: string; headers: string[]; rows: string[][] }[];

    setImportPreview(null);
    setImportWb(null);

    if (tablesData.length === 0) { setError('Все листы пустые'); return; }

    try {
      const r = await fetch(`${API_URL}/api/reference/tables/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ group_id: groupId, group_name: groupName, tables: tablesData })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTables(prev => [...data.tables, ...prev]);
    } catch (e: any) { setError(e.message); }
  };

  // Экспорт всех таблиц в один Excel-файл
  const exportAll = () => {
    if (tables.length === 0) return;
    const wb = XLSX.utils.book_new();
    tables.forEach(t => {
      const data = [t.headers, ...t.rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = t.headers.map((h, ci) => ({
        wch: Math.min(Math.max(
          h.length,
          ...t.rows.map(r => (r[ci] || '').length),
          8
        ) + 2, 40)
      }));
      // Имя листа: макс 31 символ, нельзя спецсимволы
      const sheetName = t.name.replace(/[\\/:*?[\]]/g, '').slice(0, 31) || `Таблица`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    XLSX.writeFile(wb, 'справочные_таблицы.xlsx');
  };

  return (
    <div className="ref-page">
      {/* Заголовок */}
      <div className="ref-page-header">
        <div>
          <h1>Справочные таблицы</h1>
          <p className="ref-desc">Создавайте и редактируйте справочные таблицы. Двойной клик — редактировать ячейку.</p>
        </div>
        <div className="ref-header-actions">
          {tables.length > 0 && (
            <button className="btn-main btn-green" onClick={exportAll}>
              ⬇ Экспорт всех в Excel
            </button>
          )}
          <button className="btn-main btn-teal" onClick={() => importInputRef.current?.click()}>
            ⬆ Импорт из Excel
          </button>
          <button className="btn-main btn-blue" onClick={() => setShowCreate(true)}>
            + Создать таблицу
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {error && (
        <div className="ref-error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Диалог создания */}
      {showCreate && (
        <CreateDialog
          onConfirm={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Диалог импорта */}
      {importPreview && importWb && (
        <ImportDialog
          preview={importPreview}
          onChange={setImportPreview}
          onConfirm={handleImportConfirm}
          onConfirmAll={handleImportAllConfirm}
          onClose={() => { setImportPreview(null); setImportWb(null); }}
          wb={importWb}
        />
      )}

      {/* Список таблиц */}
      {loading ? (
        <div className="ref-loading">
          <div className="spinner" />
          <span>Загрузка...</span>
        </div>
      ) : tables.length === 0 ? (
        <div className="ref-empty">
          <div className="ref-empty-icon">📋</div>
          <p>Таблиц пока нет</p>
          <button className="btn-main btn-blue" onClick={() => setShowCreate(true)}>
            Создать первую таблицу
          </button>
        </div>
      ) : (() => {
        // Группируем таблицы: сначала группы (по group_id), потом одиночные
        const groups = new Map<string, ReferenceTable[]>();
        const standalone: ReferenceTable[] = [];

        tables.forEach(t => {
          if (t.group_id) {
            const arr = groups.get(t.group_id) ?? [];
            arr.push(t);
            groups.set(t.group_id, arr);
          } else {
            standalone.push(t);
          }
        });

        const rendered: React.ReactNode[] = [];

        groups.forEach((groupTables, groupId) => {
          rendered.push(
            <TableGroup
              key={groupId}
              tables={groupTables}
              onSave={handleSave}
              onDelete={handleDelete}
              onDeleteGroup={handleDeleteGroup}
            />
          );
        });

        standalone.forEach(t => {
          rendered.push(
            <EditableTable
              key={t.id}
              table={t}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          );
        });

        return rendered;
      })()}
    </div>
  );
};

export default ReferenceData;
