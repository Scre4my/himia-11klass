/**
 * Расчёт выпарной установки
 * Методика: Дытнерский Ю.И. "Основные процессы и аппараты химической технологии", Глава 4
 *
 * Реализованы формулы:
 *   4.1  F = Q / (K * Δtп)
 *   4.2  W = Gн(1 - xн/xк)  — материальный баланс
 *   4.4  Δ' = 1.62e-2 * Δ'атм * T² / r  — температурная депрессия
 *   4.8-4.11 Система тепловых балансов по корпусам
 *   4.20 Δtпj = ΣΔtп * (Qj/Kj) / Σ(Qi/Ki)  — перераспределение ΔT
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// 1. ТАБЛИЦА НАСЫЩЕННОГО ВОДЯНОГО ПАРА
//    P в МПа, T в °C, I в кДж/кг (пар), r в кДж/кг (теплота исп.),
//    i_liq = I - r в кДж/кг (конденсат), rho_v в кг/м³
// ─────────────────────────────────────────────────────────────────
// Источник: Таблица LVII + продолжение. Давление переведено из кгс/см² в МПа (× 0,0981).
const STEAM_TABLE = [
  { P: 0.000981, T:   6.6, I: 2506, r: 2478, rho_v: 0.00760 }, // 0,01 кгс/см²
  { P: 0.001472, T:  12.7, I: 2518, r: 2465, rho_v: 0.01116 }, // 0,015
  { P: 0.001962, T:  17.1, I: 2526, r: 2455, rho_v: 0.01465 }, // 0,02
  { P: 0.002453, T:  20.7, I: 2533, r: 2447, rho_v: 0.01809 }, // 0,025
  { P: 0.002943, T:  23.7, I: 2539, r: 2440, rho_v: 0.02149 }, // 0,03
  { P: 0.003924, T:  28.6, I: 2548, r: 2429, rho_v: 0.02820 }, // 0,04
  { P: 0.004905, T:  32.5, I: 2556, r: 2420, rho_v: 0.03481 }, // 0,05
  { P: 0.005886, T:  35.8, I: 2562, r: 2413, rho_v: 0.04133 }, // 0,06
  { P: 0.007848, T:  41.1, I: 2573, r: 2400, rho_v: 0.05420 }, // 0,08
  { P: 0.009810, T:  45.8, I: 2581, r: 2390, rho_v: 0.06686 }, // 0,10
  { P: 0.011772, T:  49.0, I: 2588, r: 2382, rho_v: 0.07937 }, // 0,12
  { P: 0.014715, T:  53.6, I: 2596, r: 2372, rho_v: 0.09789 }, // 0,15
  { P: 0.019620, T:  59.7, I: 2607, r: 2358, rho_v: 0.1283  }, // 0,20
  { P: 0.029430, T:  68.7, I: 2620, r: 2336, rho_v: 0.1883  }, // 0,30
  { P: 0.039240, T:  75.4, I: 2632, r: 2320, rho_v: 0.2456  }, // 0,40
  { P: 0.049050, T:  80.9, I: 2642, r: 2307, rho_v: 0.3027  }, // 0,50
  { P: 0.058860, T:  85.5, I: 2650, r: 2296, rho_v: 0.3590  }, // 0,60
  { P: 0.068670, T:  89.3, I: 2657, r: 2281, rho_v: 0.4147  }, // 0,70
  { P: 0.078480, T:  93.0, I: 2663, r: 2278, rho_v: 0.4699  }, // 0,80
  { P: 0.088290, T:  96.2, I: 2668, r: 2270, rho_v: 0.5246  }, // 0,90
  { P: 0.098100, T:  99.1, I: 2677, r: 2264, rho_v: 0.5790  }, // 1,0
  { P: 0.117720, T: 104.2, I: 2686, r: 2249, rho_v: 0.6865  }, // 1,2
  { P: 0.137340, T: 108.7, I: 2693, r: 2237, rho_v: 0.7931  }, // 1,4
  { P: 0.156960, T: 112.7, I: 2703, r: 2227, rho_v: 0.8980  }, // 1,6
  { P: 0.176580, T: 116.9, I: 2709, r: 2217, rho_v: 1.000   }, // 1,8
  { P: 0.196200, T: 119.6, I: 2710, r: 2208, rho_v: 1.107   }, // 2,0
  { P: 0.294300, T: 132.9, I: 2730, r: 2171, rho_v: 1.618   }, // 3,0
  { P: 0.392400, T: 142.9, I: 2744, r: 2143, rho_v: 2.128   }, // 4,0
  { P: 0.490500, T: 151.1, I: 2754, r: 2117, rho_v: 2.614   }, // 5,0
  { P: 0.588600, T: 158.1, I: 2768, r: 2095, rho_v: 3.104   }, // 6,0
  { P: 0.686700, T: 164.2, I: 2769, r: 2075, rho_v: 3.591   }, // 7,0
  { P: 0.784800, T: 169.3, I: 2776, r: 2057, rho_v: 4.075   }, // 8,0
  { P: 0.882900, T: 174.5, I: 2784, r: 2040, rho_v: 4.575   }, // 9,0
  { P: 0.981000, T: 179.0, I: 2784, r: 2024, rho_v: 5.037   }, // 10
  { P: 1.079100, T: 183.2, I: 2787, r: 2009, rho_v: 5.516   }, // 11
  { P: 1.177200, T: 187.1, I: 2790, r: 1995, rho_v: 5.996   }, // 12
  { P: 1.275300, T: 190.7, I: 2793, r: 1981, rho_v: 6.474   }, // 13
  { P: 1.373400, T: 194.1, I: 2795, r: 1968, rho_v: 6.952   }, // 14
  { P: 1.471500, T: 197.4, I: 2796, r: 1956, rho_v: 7.431   }, // 15
  { P: 1.569600, T: 200.4, I: 2798, r: 1943, rho_v: 7.900   }, // 16
  { P: 1.667700, T: 203.4, I: 2799, r: 1931, rho_v: 8.389   }, // 17
  { P: 1.765800, T: 206.2, I: 2799, r: 1919, rho_v: 8.868   }, // 18
  { P: 1.863900, T: 208.8, I: 2801, r: 1909, rho_v: 9.349   }, // 19
  { P: 1.962000, T: 211.4, I: 2802, r: 1898, rho_v: 9.830   }, // 20
  { P: 2.943000, T: 232.8, I: 2801, r: 1800, rho_v: 14.70   }, // 30
  { P: 3.924000, T: 249.2, I: 2793, r: 1714, rho_v: 19.73   }, // 40
  { P: 4.905000, T: 263.9, I: 2780, r: 1637, rho_v: 24.96   }, // 50
  { P: 5.886000, T: 274.3, I: 2746, r: 1497, rho_v: 30.41   }, // 60
  { P: 7.848000, T: 293.6, I: 2726, r: 1432, rho_v: 42.13   }, // 80
  { P: 9.810000, T: 309.5, I: 2684, r: 1306, rho_v: 55.11   }, // 100
  { P: 12.2625,  T: 323.1, I: 2638, r: 1183, rho_v: 69.60   }, // 125
  { P: 15.6960,  T: 335.0, I: 2592, r: 1061, rho_v: 85.91   }, // 160
  { P: 17.6580,  T: 354.2, I: 2483, r:  799, rho_v: 104.6   }, // 180
  { P: 19.6200,  T: 364.2, I: 2400, r:  617, rho_v: 162.9   }, // 200
  { P: 22.0725,  T: 374.0, I: 2100, r:    0, rho_v: 322.6   }, // 225 (критическая точка)
];

/** Линейная интерполяция по таблице пара — по давлению */
function steamByPressure(P_MPa) {
  const tbl = STEAM_TABLE;
  if (P_MPa <= tbl[0].P) return { ...tbl[0], P: P_MPa };
  if (P_MPa >= tbl[tbl.length - 1].P) return { ...tbl[tbl.length - 1], P: P_MPa };
  for (let i = 0; i < tbl.length - 1; i++) {
    if (P_MPa <= tbl[i + 1].P) {
      const t = (P_MPa - tbl[i].P) / (tbl[i + 1].P - tbl[i].P);
      return {
        P: P_MPa,
        T:     tbl[i].T     + t * (tbl[i + 1].T     - tbl[i].T),
        I:     tbl[i].I     + t * (tbl[i + 1].I     - tbl[i].I),
        r:     tbl[i].r     + t * (tbl[i + 1].r     - tbl[i].r),
        rho_v: tbl[i].rho_v + t * (tbl[i + 1].rho_v - tbl[i].rho_v),
      };
    }
  }
}

/** Линейная интерполяция по таблице пара — по температуре насыщения */
function steamByTemperature(T_C) {
  const tbl = STEAM_TABLE;
  if (T_C <= tbl[0].T) return { ...tbl[0], T: T_C };
  if (T_C >= tbl[tbl.length - 1].T) return { ...tbl[tbl.length - 1], T: T_C };
  for (let i = 0; i < tbl.length - 1; i++) {
    if (T_C <= tbl[i + 1].T) {
      const t = (T_C - tbl[i].T) / (tbl[i + 1].T - tbl[i].T);
      return {
        T: T_C,
        P:     tbl[i].P     + t * (tbl[i + 1].P     - tbl[i].P),
        I:     tbl[i].I     + t * (tbl[i + 1].I     - tbl[i].I),
        r:     tbl[i].r     + t * (tbl[i + 1].r     - tbl[i].r),
        rho_v: tbl[i].rho_v + t * (tbl[i + 1].rho_v - tbl[i].rho_v),
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────────────────────────

/** Материальный баланс: суммарное количество выпаренной воды (кг/с) — формула 4.2 */
function totalEvaporated(Gn_kgs, xn_frac, xk_frac) {
  return Gn_kgs * (1 - xn_frac / xk_frac);
}

/**
 * Начальное распределение нагрузок по корпусам.
 * Для n корпусов используем соотношение 1.0 : 1.1 : 1.2 : ... (каждый следующий +0.1)
 */
function initialWDistribution(W, n) {
  const ratios = Array.from({ length: n }, (_, i) => 1.0 + i * 0.1);
  const sum = ratios.reduce((a, b) => a + b, 0);
  return ratios.map(r => r * W / sum);
}

/**
 * Концентрации по корпусам из материального баланса (кг/кг доли).
 * xi = Gн * xн / (Gн - Σwj, j<i)
 */
function concentrationsByMaterialBalance(Gn, xn, w_arr) {
  const x = [];
  let cumW = 0;
  for (let i = 0; i < w_arr.length; i++) {
    cumW += w_arr[i];
    x.push((Gn * xn) / (Gn - cumW));
  }
  return x;
}

/**
 * Температурная депрессия при рабочем давлении (формула 4.4):
 *   Δ' = 1.62e-2 * Δ'атм * T² / r
 * где T — температура в среднем слое кипятильных труб (К), r — теплота исп. кДж/кг
 */
function temperatureDepression(delta_atm, T_K, r_kJkg) {
  return 1.62e-2 * delta_atm * T_K * T_K / r_kJkg;
}

// ─────────────────────────────────────────────────────────────────
// 3. ОСНОВНОЙ РАСЧЁТ
// ─────────────────────────────────────────────────────────────────

/**
 * Решение системы тепловых балансов для n корпусов (формулы 4.8–4.11).
 *
 * Уравнение для i-го корпуса (i ≥ 2):
 *   w[i-1] * r_г_i = lossF * [ G_i * cp[i-1] * (tk[i] - tk[i-1]) + w[i] * r_вп_eff[i] ]
 * Для i = 1:
 *   D * r_г[0] = lossF * [ Gн * cн * (tk[0] - tn) + w[0] * r_вп_eff[0] ]
 *
 * Здесь r_г[i]     = вторичный пар из тела i служит греющим для тела i+1
 *                  ≈ Iг[i+1] - i_конд[i+1]  ≈ r_вп[i]  (теплота исп. при P_вп[i])
 * r_вп_eff[i] = Iг[i+1] - cw * tk[i]  (энтальпия вторичного пара − энтальпия воды при tk)
 *
 * Метод: бисекция по w[0], остальные w[i] находятся последовательно.
 */
function solveHeatBalance(params) {
  const { Gn, W, tk, tg_steam, Ig_steam, tBK, IBK, cp_sol, cn, tn, n, lossF } = params;

  const CW = 4.19; // теплоёмкость воды, кДж/(кг·К)

  /**
   * Для данного w[0] вычислить w[1..n-1] из балансов 2..n-го корпуса.
   * Возвращает массив w (длина n) или null если не получилось.
   */
  function computeW(w0) {
    const w = [w0];
    let G_in = Gn - w0; // расход раствора на входе в следующий корпус

    for (let i = 1; i < n; i++) {
      // Теплота конденсации греющего пара для корпуса i:
      // Греющий пар = вторичный пар из тела i-1, его r ≈ r_вп[i-1]
      // При аппроксимации Iвп[i-1] ≈ Ig_steam[i]:
      const r_heat_i = Ig_steam[i] - CW * tg_steam[i]; // ≈ r при давлении греющего пара корпуса i

      // Эффективная теплота испарения в корпусе i:
      //   (Iвп[i] - cw * tk[i]) ≈ (Ig[i+1] - cw*tk[i])  при i < n-1
      //   (IBK - cw * tk[n-1])                            при i = n-1
      const I_next = (i < n - 1) ? Ig_steam[i + 1] : IBK;
      const r_vap_eff_i = I_next - CW * tk[i];

      // Из баланса корпуса i:
      // w[i-1]*r_heat_i = lossF*( G_in*cp_sol[i-1]*(tk[i]-tk[i-1]) + w[i]*r_vap_eff_i )
      const Q_in = w[i - 1] * r_heat_i;
      const Q_sensible = lossF * G_in * cp_sol[i - 1] * (tk[i] - tk[i - 1]);
      const wi = (Q_in - Q_sensible) / (lossF * r_vap_eff_i);

      if (!isFinite(wi)) return null;
      w.push(wi);
      G_in -= wi;
    }
    return w;
  }

  // Бисекция по w[0]: ищем такое w[0], что Σw = W
  let lo = 1e-6 * W;
  let hi = 0.95 * W;

  // Проверим знак: если при lo и hi остаток одного знака — расширим диапазон
  function residual(w0) {
    const w = computeW(w0);
    if (!w) return NaN;
    return w.reduce((a, b) => a + b, 0) - W;
  }

  let bestW = null;
  for (let iter = 0; iter < 80; iter++) {
    const mid = 0.5 * (lo + hi);
    const r_lo  = residual(lo);
    const r_mid = residual(mid);

    if (Math.abs(r_mid) < 1e-9 * W) {
      bestW = computeW(mid);
      break;
    }
    if (Number.isNaN(r_lo) || Number.isNaN(r_mid)) break;

    if (r_lo * r_mid < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
    bestW = computeW(mid);
  }

  if (!bestW) {
    // Фоллбэк: равномерное распределение
    bestW = initialWDistribution(W, n);
  }

  // Рассчитать D и Q по корпусам
  const I_next1 = (n > 1) ? Ig_steam[1] : IBK;
  const r_vap_eff_0 = I_next1 - CW * tk[0];
  const r_heat_0 = Ig_steam[0] - CW * tg_steam[0]; // r_г1

  // Q1 = D * r_г1 = lossF * [Gн*cn*(tk[0]-tn) + w[0]*r_vap_eff_0]
  const Q1_kW = lossF * (Gn * cn * (tk[0] - tn) + bestW[0] * r_vap_eff_0); // кВт (=кДж/с)
  const D = Q1_kW / r_heat_0;

  const Q = [Q1_kW];
  for (let i = 1; i < n; i++) {
    const r_heat_i = Ig_steam[i] - CW * tg_steam[i];
    Q.push(bestW[i - 1] * r_heat_i);
  }

  return { D, w: bestW, Q };
}

// ─────────────────────────────────────────────────────────────────
// 3а. ФОРМИРОВАНИЕ ПРОМЕЖУТОЧНЫХ РАСЧЁТОВ
// ─────────────────────────────────────────────────────────────────
function r4(x) { return Math.round(x * 10000) / 10000; }
function r2(x) { return Math.round(x * 100) / 100; }

function buildSteps(p) {
  const {
    n, Gn, xn, xk, W, P1, Pbk, dP,
    w_dist, conc, solutionName,
    P_heat, steam_heat, steam_bk, tBK,
    t_vp, P_vp, steam_mid,
    delta_pp, delta_p, delta_atm, tk, tn,
    sumDeltaP, sumDeltaPP, sumDeltaPPP, sumDt_useful,
    D, w, Q, QK, sumQK, dt_p, F,
    K_arr, lossF, cn, cp_sol, H, e, dPPPP, rho_sol,
  } = p;
  const g = 9.81;
  const CW = 4.19;
  const Gn_h = Gn * 3600;
  const W_h  = W  * 3600;
  const steps = [];

  // Шаг 1 — Материальный баланс (ф. 4.2)
  steps.push({
    id: 'step1',
    title: 'Шаг 1. Материальный баланс',
    ref: 'Формула 4.2',
    formula: 'W = G_н · (1 − x_н / x_к)',
    rows: [
      { label: 'G_н — расход исходного раствора', expr: `${r2(Gn_h)} кг/ч = ${r4(Gn)} кг/с`, result: '' },
      { label: 'x_н — начальная концентрация', expr: `${r2(xn * 100)} % = ${r4(xn)}`, result: '' },
      { label: 'x_к — конечная концентрация',  expr: `${r2(xk * 100)} % = ${r4(xk)}`, result: '' },
      {
        label: 'W — суммарное испарение',
        expr: `${r4(Gn)} · (1 − ${r4(xn)} / ${r4(xk)})`,
        result: `${r4(W)} кг/с = ${r2(W_h)} кг/ч`,
      },
    ],
  });

  // Шаг 2 — Распределение давлений
  const ratioRows = [];
  const ratios = Array.from({ length: n }, (_, i) => 1 + i * 0.1);
  const ratioSum = ratios.reduce((a, b) => a + b, 0);
  ratioRows.push({
    label: 'Соотношение нагрузок',
    expr: ratios.map(r => r2(r)).join(' : '),
    result: `Сумма = ${r2(ratioSum)}`,
  });
  w_dist.forEach((wi, i) => {
    ratioRows.push({
      label: `w_${i + 1} — испарение в корпусе ${i + 1}`,
      expr: `${r2(ratios[i])} · ${r4(W)} / ${r2(ratioSum)}`,
      result: `${r4(wi)} кг/с = ${r2(wi * 3600)} кг/ч`,
    });
    ratioRows.push({
      label: `x_${i + 1} — концентрация после корпуса ${i + 1}`,
      expr: `${r4(Gn)} · ${r4(xn)} / (${r4(Gn)} − ${w_dist.slice(0, i + 1).map(x => r4(x)).join(' − ')})`,
      result: `${r4(conc[i])} = ${r2(conc[i] * 100)} %`,
    });
  });
  steps.push({
    id: 'step2',
    title: 'Шаг 2. Первое приближение нагрузок и концентраций по корпусам',
    ref: 'Практическое соотношение w_i',
    formula: 'w_i = k_i · W / Σk_i; x_i = G_н · x_н / (G_н − Σw_i)',
    rows: [
      ...(solutionName ? [{ label: 'Упариваемый раствор', expr: solutionName, result: 'Свойства берутся из справочных таблиц 4.3 и 4.5' }] : []),
      ...ratioRows,
    ],
  });

  const pressureRows = [
    { label: 'ΔP = (P_г1 − P_бк) / n', expr: `(${r4(P1)} − ${r4(Pbk)}) / ${n}`, result: `${r4(dP)} МПа` },
  ];
  P_heat.forEach((ph, i) => {
    const s = steam_heat[i];
    pressureRows.push({
      label: `P_г${i + 1} — греющий пар корпуса ${i + 1}`,
      expr: `${r4(P1)} − ${i} · ${r4(dP)}`,
      result: `${r4(ph)} МПа  T = ${r2(s.T)} °C  I = ${r2(s.I)} кДж/кг`,
    });
  });
  pressureRows.push({
    label: 'P_бк — барометрический конденсатор',
    expr: `${r4(Pbk)} МПа`,
    result: `T_бк = ${r2(tBK)} °C  I = ${r2(p.steam_bk.I)} кДж/кг`,
  });
  steps.push({ id: 'step3', title: 'Шаг 3. Распределение давлений по корпусам', ref: '', formula: 'P_гi = P_г1 − (i−1)·ΔP', rows: pressureRows });

  // Шаг 3 — Вторичный пар
  const vpRows = [];
  t_vp.forEach((tvp, i) => {
    const t_next = i < n - 1 ? steam_heat[i + 1].T : tBK;
    vpRows.push({
      label: `Корпус ${i + 1}: t_вп`,
      expr: `t_г${i < n - 1 ? i + 2 : 'бк'} + Δ''' = ${r2(t_next)} + ${dPPPP}`,
      result: `${r2(tvp)} °C → P_вп = ${r4(P_vp[i])} МПа`,
    });
  });
  steps.push({ id: 'step4', title: 'Шаг 4. Температуры и давления вторичных паров', ref: '', formula: 't_вп,i = t_г,i+1 + Δ\'\'\'', rows: vpRows });

  // Шаг 4 — Гидростатическая депрессия Δ''
  const dppRows = [];
  t_vp.forEach((tvp, i) => {
    const Pmid_Pa = P_vp[i] * 1e6 + rho_sol[i] * g * H * (1 - e) / 2;
    const Pmid_MPa = Pmid_Pa / 1e6;
    dppRows.push({
      label: `Корпус ${i + 1}`,
      expr: `P_ср = ${r4(P_vp[i])} МПа + ${r2(rho_sol[i])}·${g}·${H}·${1 - e}/2 = ${r4(Pmid_MPa)} МПа → T_ср = ${r2(steam_mid[i].T)} °C`,
      result: `Δ'' = ${r2(steam_mid[i].T)} − ${r2(tvp)} = ${r2(delta_pp[i])} °C`,
    });
  });
  steps.push({ id: 'step5', title: 'Шаг 5. Гидростатическая депрессия Δ\'\'', ref: '', formula: 'P_ср = P_вп + ρ·g·H·(1−e)/2', rows: dppRows });

  // Шаг 5 — Температурная депрессия Δ' (ф. 4.4)
  const dpRows = [];
  t_vp.forEach((_tvp, i) => {
    const T_K = steam_mid[i].T + 273.15;
    const r   = steam_mid[i].r;
    dpRows.push({
      label: `Корпус ${i + 1}`,
      expr: `1,62×10⁻² · ${r2(delta_atm[i])} · ${r2(T_K)}² / ${r2(r)} = 1,62×10⁻² · ${r2(delta_atm[i])} · ${r2(T_K * T_K)} / ${r2(r)}`,
      result: `Δ' = ${r2(delta_p[i])} °C`,
    });
  });
  steps.push({ id: 'step6', title: 'Шаг 6. Температурная депрессия Δ\'', ref: 'Формула 4.4', formula: 'Δ\' = 1,62·10⁻² · Δ\'_атм · T²_ср / r_ср', rows: dpRows });

  // Шаг 6 — Температуры кипения
  const tkRows = [];
  tk.forEach((tki, i) => {
    const t_next = i < n - 1 ? steam_heat[i + 1].T : tBK;
    tkRows.push({
      label: `Корпус ${i + 1}: t_к`,
      expr: `${r2(t_next)} + ${r2(delta_p[i])} + ${r2(delta_pp[i])} + ${dPPPP}`,
      result: `${r2(tki)} °C`,
    });
  });
  tkRows.push({ label: 't_н — температура исходного раствора', expr: `t_вп,1 + Δ'_н = ${r2(t_vp[0])} + ${dPPPP}`, result: `${r2(tn)} °C` });
  steps.push({ id: 'step7', title: 'Шаг 7. Температуры кипения раствора по корпусам', ref: '', formula: 't_к,i = t_г,i+1 + Δ\'_i + Δ\'\'_i + Δ\'\'\'', rows: tkRows });

  // Шаг 7 — Суммарная полезная ΔT
  steps.push({
    id: 'step8',
    title: 'Шаг 8. Суммарная полезная разность температур',
    ref: '',
    formula: 'ΣΔt_п = T_г1 − t_бк − ΣΔ\' − ΣΔ\'\' − ΣΔ\'\'\'',
    rows: [
      { label: 'T_г1 − t_бк', expr: `${r2(steam_heat[0].T)} − ${r2(tBK)}`, result: `${r2(steam_heat[0].T - tBK)} °C` },
      { label: 'ΣΔ\' (температурная)', expr: delta_p.map(d => r2(d)).join(' + '), result: `${r2(sumDeltaP)} °C` },
      { label: 'ΣΔ\'\' (гидростатическая)', expr: delta_pp.map(d => r2(d)).join(' + '), result: `${r2(sumDeltaPP)} °C` },
      { label: 'ΣΔ\'\'\' (гидродинамическая)', expr: `${n} · ${dPPPP}`, result: `${r2(sumDeltaPPP)} °C` },
      { label: 'ΣΔt_п полезная', expr: `${r2(steam_heat[0].T - tBK)} − ${r2(sumDeltaP)} − ${r2(sumDeltaPP)} − ${r2(sumDeltaPPP)}`, result: `${r2(sumDt_useful)} °C` },
    ],
  });

  // Шаг 8 — Тепловые балансы (ф. 4.8–4.11)
  const hbRows = [];
  const I_next1 = n > 1 ? steam_heat[1].I : tBK + 2500;
  const r_vap_eff_0 = I_next1 - CW * tk[0];
  const r_heat_0 = steam_heat[0].I - CW * steam_heat[0].T;
  hbRows.push({
    label: 'Q₁ — тепловая нагрузка корпуса 1',
    expr: `${r2(lossF)} · [${r4(Gn)} · ${r4(cn)} · (${r2(tk[0])} − ${r2(tn)}) + ${r4(w[0])} · ${r2(r_vap_eff_0)}]`,
    result: `${r2(Q[0])} кВт`,
  });
  hbRows.push({
    label: 'D — расход свежего пара',
    expr: `Q₁ / r_г1 = ${r2(Q[0])} / ${r2(r_heat_0)}`,
    result: `${r2(D)} кг/с = ${r2(D * 3600)} кг/ч`,
  });
  for (let i = 1; i < n; i++) {
    const r_heat_i = steam_heat[i].I - CW * steam_heat[i].T;
    hbRows.push({
      label: `Q${i + 1} — тепловая нагрузка корпуса ${i + 1}`,
      expr: `w${i} · r_г${i + 1} = ${r4(w[i - 1])} · ${r2(r_heat_i)}`,
      result: `${r2(Q[i])} кВт`,
    });
    hbRows.push({
      label: `w${i + 1} — испарение в корпусе ${i + 1}`,
      expr: `(из теплового баланса)`,
      result: `${r4(w[i])} кг/с = ${r2(w[i] * 3600)} кг/ч`,
    });
  }
  steps.push({ id: 'step9', title: 'Шаг 9. Тепловые балансы по корпусам', ref: 'Формулы 4.8–4.11', formula: 'D·r_г1 = φ·[G_н·c_н·(t_к1−t_н) + w₁·r_вп,эфф]', rows: hbRows });

  // Шаг 9 — Перераспределение ΔT (ф. 4.20)
  const dtRows = [];
  dtRows.push({ label: 'Σ(Q_j / K_j)', expr: QK.map((qk, i) => `Q${i + 1}/K${i + 1} = ${r2(Q[i])}/${K_arr[i]} = ${r4(qk)}`).join('; '), result: `Σ = ${r4(sumQK)}` });
  dt_p.forEach((dt, i) => {
    dtRows.push({
      label: `Δt_п,${i + 1} — корпус ${i + 1}`,
      expr: `${r2(sumDt_useful)} · ${r4(QK[i])} / ${r4(sumQK)}`,
      result: `${r2(dt)} °C`,
    });
  });
  steps.push({ id: 'step10', title: 'Шаг 10. Перераспределение Δt_п по корпусам', ref: 'Формула 4.20', formula: 'Δt_п,j = ΣΔt_п · (Q_j/K_j) / Σ(Q_i/K_i)', rows: dtRows });

  // Шаг 10 — Поверхность теплообмена (ф. 4.1)
  const fRows = [];
  F.forEach((fi, i) => {
    fRows.push({
      label: `F_${i + 1} — площадь корпуса ${i + 1}`,
      expr: `Q${i + 1}·1000 / (K${i + 1}·|Δt_п,${i + 1}|) = ${r2(Q[i])}·1000 / (${K_arr[i]}·${r2(Math.abs(dt_p[i]))})`,
      result: `${r2(fi)} м²`,
    });
  });
  fRows.push({ label: 'Суммарная площадь', expr: F.map(fi => r2(fi)).join(' + '), result: `${r2(F.reduce((a, b) => a + b, 0))} м²` });
  steps.push({ id: 'step11', title: 'Шаг 11. Поверхность теплообмена', ref: 'Формула 4.1', formula: 'F = Q / (K · Δt_п)', rows: fRows });

  return steps;
}

// ─────────────────────────────────────────────────────────────────
// 4. ГЛАВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────────────────────────────

/**
 * Расчёт трёхкорпусной (или n-корпусной) выпарной установки.
 *
 * Входные параметры (input):
 *   feedFlowRate          — Gн, кг/ч
 *   initialConcentration  — xн, % (масс.)
 *   finalConcentration    — xк, % (масс.)
 *   steamPressure         — Pг1, МПа (греющий пар в 1-м корпусе)
 *   condenserPressure     — Pбк, МПа (барометрический конденсатор)
 *   numberOfEffects       — n (корпусов)
 *   heatTransferCoefficients — K, Вт/(м²·К): число или массив из n значений
 *   solutionDensities     — ρ, кг/м³: массив n значений (плотность р-ра в корпусах)
 *   solutionHeatCapacities — cp, кДж/(кг·К): массив n значений
 *   atmosphericDepressions — Δ'атм, °С: массив n значений (температурная депрессия при атм. давлении)
 *   feedHeatCapacity      — cн, кДж/(кг·К) (теплоёмкость исходного р-ра)
 *   feedAtmosphericDepression — Δ'н, °С (депрессия исходного р-ра при атм. давлении)
 *   tubeHeight            — H, м (высота кипятильных труб, по умолчанию 4)
 *   steamFraction         — e (паронаполнение, по умолчанию 0.5)
 *   hydrodynamicDepression — Δ''', °С на корпус (по умолчанию 1.0)
 *   heatLossFactor        — 1.03 (потери тепла)
 *
 * Также принимает устаревшие поля для обратной совместимости:
 *   steamTemperature, vacuumPressure, heatTransferCoefficient (скаляр),
 *   vaporizationHeat, condensationHeat, pressureLoss
 */
function calculateEvaporatorBattery(input) {
  validateInput(input);

  // ── Нормализация параметров ──────────────────────────────────
  const n = input.numberOfEffects || 3;

  // Расход в кг/с
  const Gn = (input.feedFlowRate || 0) / 3600;

  const xn = (input.initialConcentration || 0) / 100; // доли
  const xk = (input.finalConcentration  || 0) / 100;

  // Давления
  let P1 = input.steamPressure;
  if (!P1 && input.steamTemperature) {
    // Обратная совместимость: из температуры найдём давление
    P1 = steamByTemperature(input.steamTemperature).P;
  }
  P1 = P1 || 1.079;

  let Pbk = input.condenserPressure || input.vacuumPressure || 0.0147;

  // Коэффициенты теплопередачи (массив длины n)
  let K_arr;
  if (Array.isArray(input.heatTransferCoefficients) && input.heatTransferCoefficients.length === n) {
    K_arr = input.heatTransferCoefficients;
  } else {
    const K_val = input.heatTransferCoefficient || input.heatTransferCoefficients || 1800;
    K_arr = Array(n).fill(typeof K_val === 'number' ? K_val : K_val[0]);
  }

  // Плотности раствора по корпусам (кг/м³), по умолчанию ~ вода
  const rho_sol = Array.isArray(input.solutionDensities) && input.solutionDensities.length === n
    ? input.solutionDensities
    : Array(n).fill(input.solutionDensity || 1050);

  // Теплоёмкости раствора (кДж/(кг·К))
  const cp_sol = Array.isArray(input.solutionHeatCapacities) && input.solutionHeatCapacities.length === n
    ? input.solutionHeatCapacities
    : Array(n).fill(input.solutionHeatCapacity || 3.8);

  // Температурная депрессия при атм. давлении по корпусам (°С)
  const delta_atm = Array.isArray(input.atmosphericDepressions) && input.atmosphericDepressions.length === n
    ? input.atmosphericDepressions
    : Array(n).fill(input.atmosphericDepression || 1.0);

  const cn    = input.feedHeatCapacity          || 3.9;  // теплоёмкость исходного р-ра
  const delta_n = input.feedAtmosphericDepression || 1.0; // депрессия исходного р-ра
  const H     = input.tubeHeight                || 4.0;  // высота труб
  const e     = input.steamFraction             || 0.5;  // паронаполнение
  const dPPPP = input.hydrodynamicDepression    || 1.0;  // Δ''' на корпус
  const lossF = input.heatLossFactor            || 1.03;

  // ── Шаг 1: Общее количество выпаренной воды (кг/с) ───────────
  const W = totalEvaporated(Gn, xn, xk);

  // ── Шаг 2: Начальное распределение нагрузок по корпусам ──────
  let w_dist = initialWDistribution(W, n);

  // ── Шаг 3: Концентрации по корпусам (материальный баланс) ────
  let conc = concentrationsByMaterialBalance(Gn, xn, w_dist);

  // ── Шаг 4: Распределение давлений ────────────────────────────
  // ΔPоб = Pг1 - Pбк, равномерно по корпусам
  const dP = (P1 - Pbk) / n;
  const P_heat = Array.from({ length: n }, (_, i) => P1 - i * dP); // Pгi
  const steam_heat = P_heat.map(steamByPressure);   // свойства греющего пара

  // Свойства пара в барометрическом конденсаторе
  const steam_bk = steamByPressure(Pbk);
  const tBK = steam_bk.T;
  const IBK = steam_bk.I; // кДж/кг

  // ── Шаг 5: Температуры вторичных паров (с гидродинамической депрессией Δ''') ──
  // tвп_i = tг_(i+1) + Δ'''  (для i < n)
  // tвп_n = tбк + Δ'''
  const t_vp = Array.from({ length: n }, (_, i) => {
    const t_next = (i < n - 1) ? steam_heat[i + 1].T : tBK;
    return t_next + dPPPP;
  });

  // Давления вторичных паров (по температурам вторичных паров)
  const steam_vp = t_vp.map(steamByTemperature);
  const P_vp = steam_vp.map(s => s.P);

  // ── Шаг 6: Гидростатическая депрессия Δ'' ────────────────────
  // Pср = Pвп + ρ*g*H*(1-e)/2  [в Па!]
  const g = 9.81;
  const P_mid_Pa = P_vp.map((p, i) => p * 1e6 + rho_sol[i] * g * H * (1 - e) / 2);
  const P_mid    = P_mid_Pa.map(p => p / 1e6); // обратно в МПа
  const steam_mid = P_mid.map(steamByPressure);

  const delta_pp = Array.from({ length: n }, (_, i) => steam_mid[i].T - t_vp[i]); // Δ''

  // ── Шаг 7: Температурная депрессия Δ' ────────────────────────
  // Δ' = 1.62e-2 * Δ'атм * T² / r  (формула 4.4)
  // T в среднем слое кипятильных труб (в К), r в кДж/кг
  const delta_p = Array.from({ length: n }, (_, i) => {
    const T_K = steam_mid[i].T + 273.15;
    const r   = steam_mid[i].r; // кДж/кг
    return temperatureDepression(delta_atm[i], T_K, r);
  });

  // ── Шаг 8: Температуры кипения растворов по корпусам ─────────
  // tк_i = tг_(i+1) + Δ'_i + Δ''_i + Δ'''_i
  const tk = Array.from({ length: n }, (_, i) => {
    const t_next = (i < n - 1) ? steam_heat[i + 1].T : tBK;
    return t_next + delta_p[i] + delta_pp[i] + dPPPP;
  });

  // Температура кипения исходного раствора при давлении в 1-м корпусе
  const tn = t_vp[0] + delta_n; // tвп1 + Δ'н

  // ── Шаг 9: Суммарная полезная разность температур ────────────
  const sumDeltaP   = delta_p.reduce((a, b) => a + b, 0);
  const sumDeltaPP  = delta_pp.reduce((a, b) => a + b, 0);
  const sumDeltaPPP = n * dPPPP;

  const sumDt_useful = steam_heat[0].T - tBK - sumDeltaP - sumDeltaPP - sumDeltaPPP;

  // Полезная разность температур по корпусам (первое приближение)
  const dt_p_first = tk.map((t, i) => steam_heat[i].T - t);

  // ── Шаг 10: Решение системы тепловых балансов ─────────────────
  const heatBalanceResult = solveHeatBalance({
    Gn,
    W,
    tk,
    tg_steam: steam_heat.map(s => s.T),
    Ig_steam: steam_heat.map(s => s.I),
    tBK,
    IBK,
    cp_sol,
    cn,
    tn,
    n,
    lossF,
  });

  const { D, w, Q } = heatBalanceResult;

  // ── Шаг 11: Перераспределение ΔT по условию равенства поверхностей (формула 4.20) ──
  // Δtп_j = ΣΔtп * (Qj/Kj) / Σ(Qi/Ki)
  const QK = Q.map((q, i) => q / K_arr[i]); // Qi/Ki
  const sumQK = QK.reduce((a, b) => a + b, 0);
  const dt_p = QK.map(qk => sumDt_useful * qk / sumQK);

  // ── Шаг 12: Поверхность теплопередачи (формула 4.1) ──────────
  // F = Q / (K * Δtп)  →  Q в кВт = 1000 Вт, K в Вт/(м²·К)
  const F = Q.map((q, i) => (q * 1000) / (K_arr[i] * Math.abs(dt_p[i])));

  // ── Формирование результата ───────────────────────────────────
  const stages = Array.from({ length: n }, (_, i) => ({
    stageNumber:         i + 1,
    temperature:         Math.round(tk[i] * 100) / 100,          // °C
    heatingTemperature:  Math.round(steam_heat[i].T * 100) / 100, // °C
    pressure:            Math.round(P_vp[i] * 1e4) / 1e4,        // МПа (вторичный пар)
    heatingPressure:     Math.round(P_heat[i] * 1e4) / 1e4,      // МПа (греющий пар)
    feedFlowRate:        Math.round(Gn * 3600 * 10) / 10,        // кг/ч
    evaporatedWater:     Math.round(w[i] * 3600 * 100) / 100,    // кг/ч
    concentrationIn:     Math.round((i === 0 ? xn : conc[i - 1]) * 10000) / 100, // %
    concentrationOut:    Math.round(conc[i] * 10000) / 100,      // %
    steamConsumption:    i === 0
      ? Math.round(D * 3600 * 100) / 100
      : Math.round(w[i - 1] * 3600 * 100) / 100,                // кг/ч
    heatExchangeArea:    Math.round(F[i] * 100) / 100,           // м²
    heatLoad:            Math.round(Q[i] * 10) / 10,             // кВт
    usefulDeltaT:        Math.round(dt_p[i] * 100) / 100,        // °С
    deltaT_total:        Math.round(dt_p_first[i] * 100) / 100,  // °С (первое прибл.)
    temperatureDepression:   Math.round(delta_p[i] * 100) / 100,  // Δ', °С
    hydrostaticDepression:   Math.round(delta_pp[i] * 100) / 100, // Δ'', °С
    hydrodynamicDepression:  dPPPP,                               // Δ''', °С
    heatTransferCoefficient: K_arr[i],
  }));

  const totalEvaporatedWater   = w.reduce((a, b) => a + b, 0) * 3600;
  const totalSteamConsumption  = D * 3600;
  const steamEconomy           = totalEvaporatedWater / totalSteamConsumption;
  const totalHeatExchangeArea  = F.reduce((a, b) => a + b, 0);
  const averageHeatExchangeArea = totalHeatExchangeArea / n;

  // ── Промежуточные расчёты ─────────────────────────────────────
  const steps = buildSteps({
    n, Gn, xn, xk, W, P1, Pbk, dP,
    w_dist, conc, solutionName: input.solutionName,
    P_heat, steam_heat, steam_bk, tBK, IBK,
    t_vp, P_vp, steam_vp, P_mid, steam_mid,
    delta_pp, delta_p, delta_atm, tk, tn,
    sumDeltaP, sumDeltaPP, sumDeltaPPP, sumDt_useful,
    D, w, Q, QK, sumQK, dt_p, F,
    K_arr, lossF, cn, cp_sol, H, e, dPPPP, rho_sol,
  });

  return {
    input,
    stages,
    steps,
    totalEvaporatedWater:    Math.round(totalEvaporatedWater  * 100) / 100,
    totalSteamConsumption:   Math.round(totalSteamConsumption * 100) / 100,
    steamEconomy:            Math.round(steamEconomy * 1000) / 1000,
    totalHeatExchangeArea:   Math.round(totalHeatExchangeArea   * 100) / 100,
    averageHeatExchangeArea: Math.round(averageHeatExchangeArea * 100) / 100,
    summary: {
      W_total_kgs:     Math.round(W * 10000) / 10000,
      steamPressure:   P1,
      condenserTemp:   Math.round(tBK * 100) / 100,
      sumDelta_prime:  Math.round(sumDeltaP   * 100) / 100,
      sumDelta_double: Math.round(sumDeltaPP  * 100) / 100,
      sumDelta_triple: Math.round(sumDeltaPPP * 100) / 100,
      sumUsefulDeltaT: Math.round(sumDt_useful * 100) / 100,
    }
  };
}

// ─────────────────────────────────────────────────────────────────
// 5. ВАЛИДАЦИЯ
// ─────────────────────────────────────────────────────────────────
function validateInput(input) {
  const errors = [];

  const n = input.numberOfEffects;
  if (!n || n < 1 || n > 10) errors.push('Количество корпусов должно быть от 1 до 10');

  if (!input.feedFlowRate || input.feedFlowRate <= 0)
    errors.push('Расход раствора должен быть положительным');

  const xn = input.initialConcentration;
  const xk = input.finalConcentration;

  if (!xn || xn <= 0 || xn >= 100)
    errors.push('Начальная концентрация должна быть от 0 до 100%');

  if (!xk || xk <= 0 || xk >= 100)
    errors.push('Конечная концентрация должна быть от 0 до 100%');

  if (xk && xn && xk <= xn)
    errors.push('Конечная концентрация должна быть больше начальной');

  const P1 = input.steamPressure;
  if (P1 !== undefined && (P1 <= 0 || P1 > 5))
    errors.push('Давление греющего пара должно быть от 0 до 5 МПа');

  if (errors.length > 0) throw new Error('Ошибки валидации: ' + errors.join('; '));
}

// ─────────────────────────────────────────────────────────────────
// 6. ОПТИМИЗАЦИЯ ЧИСЛА КОРПУСОВ
// ─────────────────────────────────────────────────────────────────
function optimizeNumberOfEffects(input) {
  let optimalN = 1;
  let bestEconomy = 0;
  const maxN = input.maxEffects || 6;

  for (let n = 1; n <= maxN; n++) {
    try {
      const result = calculateEvaporatorBattery({ ...input, numberOfEffects: n });
      if (result.steamEconomy > bestEconomy) {
        bestEconomy = result.steamEconomy;
        optimalN = n;
      }
    } catch (_) {
      // пропустить неудачный вариант
    }
  }

  return {
    optimalNumberOfEffects: optimalN,
    steamEconomy: bestEconomy,
    result: calculateEvaporatorBattery({ ...input, numberOfEffects: optimalN }),
  };
}

// ─────────────────────────────────────────────────────────────────
// 7. ЭКСПОРТ (обратная совместимость)
// ─────────────────────────────────────────────────────────────────

/** @deprecated Используйте calculateEvaporatorBattery */
function calculateEvaporatedWater(feedFlow, concentrationIn, concentrationOut) {
  if (concentrationOut <= concentrationIn) throw new Error('xк должна быть > xн');
  return feedFlow * (1 - concentrationIn / concentrationOut);
}

/** @deprecated */
function calculateFinalFlowRate(initialFlow, totalEvap) {
  const f = initialFlow - totalEvap;
  if (f <= 0) throw new Error('Расход стал отрицательным');
  return f;
}

/** @deprecated */
function calculateHeatLoad(evaporatedWater_kgs, r_kJkg) {
  return evaporatedWater_kgs * r_kJkg; // кВт
}

/** @deprecated */
function calculateSteamConsumption(heatLoad_kW, r_kJkg) {
  return (heatLoad_kW * 3600) / r_kJkg; // кг/ч
}

/** @deprecated */
function calculateHeatExchangeArea(heatLoad_kW, K, deltaT) {
  if (deltaT <= 0) throw new Error('ΔT должна быть положительной');
  return (heatLoad_kW * 1000) / (K * deltaT);
}

/** @deprecated */
function distributeTemperatures(steamTemp, finalTemp, n) {
  const step = (steamTemp - finalTemp) / n;
  return Array.from({ length: n }, (_, i) => steamTemp - step * i);
}

/** @deprecated */
function distributePressures(steamP, vacP, n) {
  const step = (steamP - (vacP || 0.01)) / n;
  return Array.from({ length: n }, (_, i) => steamP - step * i);
}

/** @deprecated */
function distributeConcentrations(xn, xk, n) {
  const step = (xk - xn) / n;
  return Array.from({ length: n + 1 }, (_, i) => xn + step * i);
}

module.exports = {
  // Основное API
  calculateEvaporatorBattery,
  validateInput,
  optimizeNumberOfEffects,
  // Вспомогательные (публичные для тестирования)
  steamByPressure,
  steamByTemperature,
  totalEvaporated,
  concentrationsByMaterialBalance,
  temperatureDepression,
  solveHeatBalance,
  // Устаревшие (обратная совместимость)
  calculateEvaporatedWater,
  calculateFinalFlowRate,
  calculateHeatLoad,
  calculateSteamConsumption,
  calculateHeatExchangeArea,
  distributeTemperatures,
  distributePressures,
  distributeConcentrations,
};
