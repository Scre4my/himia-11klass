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
const STEAM_TABLE = [
  { P: 0.005, T:  32.9, I: 2561, r: 2424, rho_v: 0.035 },
  { P: 0.010, T:  45.8, I: 2585, r: 2393, rho_v: 0.068 },
  { P: 0.015, T:  54.0, I: 2599, r: 2372, rho_v: 0.102 },
  { P: 0.020, T:  60.1, I: 2610, r: 2358, rho_v: 0.131 },
  { P: 0.030, T:  69.1, I: 2625, r: 2336, rho_v: 0.198 },
  { P: 0.050, T:  81.3, I: 2646, r: 2305, rho_v: 0.318 },
  { P: 0.070, T:  90.0, I: 2660, r: 2283, rho_v: 0.444 },
  { P: 0.100, T:  99.6, I: 2676, r: 2258, rho_v: 0.590 },
  { P: 0.150, T: 111.4, I: 2694, r: 2226, rho_v: 0.863 },
  { P: 0.200, T: 120.2, I: 2707, r: 2202, rho_v: 1.129 },
  { P: 0.300, T: 133.5, I: 2725, r: 2164, rho_v: 1.651 },
  { P: 0.400, T: 143.6, I: 2739, r: 2133, rho_v: 2.163 },
  { P: 0.500, T: 151.9, I: 2749, r: 2108, rho_v: 2.669 },
  { P: 0.600, T: 158.9, I: 2757, r: 2086, rho_v: 3.170 },
  { P: 0.700, T: 165.0, I: 2764, r: 2066, rho_v: 3.666 },
  { P: 0.800, T: 170.4, I: 2769, r: 2048, rho_v: 4.161 },
  { P: 0.900, T: 175.4, I: 2774, r: 2031, rho_v: 4.654 },
  { P: 1.000, T: 179.9, I: 2778, r: 2015, rho_v: 5.145 },
  { P: 1.100, T: 184.1, I: 2782, r: 2000, rho_v: 5.628 },
  { P: 1.200, T: 188.0, I: 2785, r: 1986, rho_v: 6.124 },
  { P: 1.300, T: 191.6, I: 2788, r: 1972, rho_v: 6.617 },
  { P: 1.500, T: 198.3, I: 2792, r: 1947, rho_v: 7.594 },
  { P: 2.000, T: 212.4, I: 2800, r: 1891, rho_v: 10.04 },
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
    x.push((Gn * xn) / (Gn - cumW));
    cumW += w_arr[i];
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

  return {
    input,
    stages,
    totalEvaporatedWater:    Math.round(totalEvaporatedWater  * 100) / 100, // кг/ч
    totalSteamConsumption:   Math.round(totalSteamConsumption * 100) / 100, // кг/ч
    steamEconomy:            Math.round(steamEconomy * 1000) / 1000,
    totalHeatExchangeArea:   Math.round(totalHeatExchangeArea   * 100) / 100, // м²
    averageHeatExchangeArea: Math.round(averageHeatExchangeArea * 100) / 100, // м²
    // Дополнительные итоги
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
