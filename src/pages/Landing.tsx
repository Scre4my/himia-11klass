import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const features = [
  {
    icon: '⚗️',
    title: 'Расчёт выпарных батарей',
    desc: 'Многокорпусные и вакуумные выпарные установки. Прямоточная, противоточная и смешанная схемы движения потоков.',
  },
  {
    icon: '📊',
    title: 'Детальные результаты',
    desc: 'Температура, давление, нагрузка по пару, площадь теплообмена и КПД — по каждому корпусу установки.',
  },
  {
    icon: '📐',
    title: 'Пошаговый калькулятор',
    desc: 'Пошаговый режим расчёта с визуализацией схемы установки и интерактивными графиками.',
  },
  {
    icon: '📚',
    title: 'Справочные таблицы',
    desc: 'Загрузка и хранение собственных справочных данных: свойства растворов, теплофизические константы, характеристики оборудования.',
  },
  {
    icon: '💾',
    title: 'Сохранение проектов',
    desc: 'Все выполненные расчёты сохраняются в личном кабинете. Можно вернуться к любому проекту в любой момент.',
  },
  {
    icon: '📄',
    title: 'Экспорт отчётов',
    desc: 'Выгрузка результатов расчёта в PDF и Excel для оформления технической документации.',
  },
];

const planned = [
  { icon: '🔍', text: 'Оптимизация числа корпусов по минимуму приведённых затрат' },
  { icon: '🌡️', text: 'Учёт потерь давления и температурных депрессий по методу ВНИИХИММАШ' },
  { icon: '🤝', text: 'Совместный доступ к проектам внутри организации' },
  { icon: '📈', text: 'Сравнение нескольких вариантов расчёта на одном графике' },
  { icon: '🖨️', text: 'Автоматическая генерация пояснительной записки по ГОСТ' },
  { icon: '🔗', text: 'Интеграция с базой данных стандартного оборудования (ГОСТ / ТУ)' },
];

const Landing: React.FC = () => {
  const isAuth = !!localStorage.getItem('token');

  return (
    <div className="landing">

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-inner">
          <div className="hero-badge">Программный комплекс</div>
          <h1 className="hero-title">ТехноПар</h1>
          <p className="hero-subtitle">
            Инженерный инструмент для расчёта выпарных установок в&nbsp;химической
            и&nbsp;пищевой промышленности
          </p>
          <div className="hero-actions">
            {isAuth ? (
              <Link to="/calculator" className="btn-hero btn-hero--primary">Перейти к расчётам</Link>
            ) : (
              <>
                <Link to="/login" className="btn-hero btn-hero--primary">Войти в систему</Link>
                <a href="#features" className="btn-hero btn-hero--outline">Узнать больше</a>
              </>
            )}
          </div>
        </div>
        <div className="hero-visual" aria-hidden>
          <div className="hero-diagram">
            {[1, 2, 3].map(n => (
              <div key={n} className="hd-effect">
                <div className="hd-body">{n}</div>
                <div className="hd-arrow">→</div>
              </div>
            ))}
            <div className="hd-end">💧</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section" id="features">
        <div className="section-inner">
          <h2 className="section-title">Возможности системы</h2>
          <p className="section-sub">Всё необходимое для инженерного расчёта выпарной установки — в одном месте</p>
          <div className="features-grid">
            {features.map(f => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section landing-section--alt">
        <div className="section-inner">
          <h2 className="section-title">Как это работает</h2>
          <div className="steps-row">
            <div className="step">
              <div className="step-num">1</div>
              <h4>Задайте параметры</h4>
              <p>Тип установки, число корпусов, расход и концентрация питания, температура пара</p>
            </div>
            <div className="step-connector" />
            <div className="step">
              <div className="step-num">2</div>
              <h4>Получите результат</h4>
              <p>Система рассчитывает распределение по корпусам, расход пара и площадь теплообмена</p>
            </div>
            <div className="step-connector" />
            <div className="step">
              <div className="step-num">3</div>
              <h4>Сохраните и экспортируйте</h4>
              <p>Сохраните проект, сравните варианты, выгрузите отчёт в PDF или Excel</p>
            </div>
          </div>
        </div>
      </section>

      {/* Planned */}
      <section className="landing-section">
        <div className="section-inner">
          <h2 className="section-title">Что планируется</h2>
          <p className="section-sub">Система активно развивается — вот что появится в ближайшее время</p>
          <div className="planned-grid">
            {planned.map(p => (
              <div key={p.text} className="planned-item">
                <span className="planned-icon">{p.icon}</span>
                <span>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="section-inner">
          <h2>Готовы начать?</h2>
          <p>Войдите в систему и выполните первый расчёт за несколько минут</p>
          {isAuth ? (
            <Link to="/calculator" className="btn-hero btn-hero--primary">Открыть калькулятор</Link>
          ) : (
            <Link to="/login" className="btn-hero btn-hero--light">Войти в систему</Link>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <p>© 2024 ТехноПар — расчёт выпарных установок</p>
      </footer>
    </div>
  );
};

export default Landing;
