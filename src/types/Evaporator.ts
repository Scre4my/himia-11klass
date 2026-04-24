// Типы выпарных установок
export type EvaporatorType = 'direct-flow' | 'forced-circulation' | 'film-rising' | 'film-falling' | 'vacuum';

// Направление потока
export type FlowDirection = 'direct' | 'counter' | 'mixed';

// Входные данные для расчёта
export interface CalculationInput {
  evaporatorType: EvaporatorType;
  flowDirection: FlowDirection;
  numberOfEffects: number;              // количество корпусов (1-10)
  feedFlowRate: number;                 // Gн - расход исходного раствора, кг/ч

  initialConcentration: number;         // xн - начальная концентрация, % (масс.)
  finalConcentration: number;           // xк - конечная концентрация, % (масс.)

  // Давления (методика Дытнерского)
  steamPressure: number;                // Pг1 — давление греющего пара в 1-м корпусе, МПа
  condenserPressure: number;            // Pбк — давление в барометрическом конденсаторе, МПа

  // Коэффициенты теплопередачи по корпусам, Вт/(м²·К)
  heatTransferCoefficients: number[];

  // Плотности раствора по корпусам, кг/м³
  solutionDensities: number[];

  // Теплоёмкости раствора по корпусам, кДж/(кг·К)
  solutionHeatCapacities: number[];

  // Температурная депрессия при атм. давлении по корпусам, °С
  atmosphericDepressions: number[];

  // Параметры исходного раствора
  feedHeatCapacity: number;             // cн, кДж/(кг·К)
  feedAtmosphericDepression: number;    // Δ'н, °С

  // Конструктивные параметры
  tubeHeight: number;                   // H — высота кипятильных труб, м
  steamFraction: number;                // e — паронаполнение (0-1)

  // Депрессии
  hydrodynamicDepression: number;       // Δ''' — гидродинамическая депрессия, °С на корпус

  // Коэффициент потерь тепла
  heatLossFactor: number;

  // Устаревшие поля (обратная совместимость)
  steamTemperature?: number;
  heatTransferCoefficient?: number;
  vaporizationHeat?: number;
  condensationHeat?: number;
  pressureLoss?: number;
  vacuumPressure?: number;
}

// Результаты расчёта одного корпуса
export interface StageResult {
  stageNumber: number;
  // Температуры
  temperature: number;          // tк — температура кипения раствора, °C
  heatingTemperature: number;   // tг — температура греющего пара, °C
  // Давления
  pressure: number;             // Pвп — давление вторичного пара, МПа
  heatingPressure: number;      // Pг — давление греющего пара, МПа
  // Потоки
  feedFlowRate: number;         // расход раствора на входе, кг/ч
  evaporatedWater: number;      // wi — количество испарённой воды, кг/ч
  concentrationIn: number;      // концентрация на входе, %
  concentrationOut: number;     // концентрация на выходе, %
  steamConsumption: number;     // расход греющего пара, кг/ч
  // Теплообмен
  heatExchangeArea: number;     // F — площадь теплообмена, м²
  heatLoad: number;             // Q — тепловая нагрузка, кВт
  heatTransferCoefficient: number; // K — коэффициент теплопередачи, Вт/(м²·К)
  usefulDeltaT: number;         // Δtп — полезная разность температур, °С
  deltaT_total: number;         // Δt общая (первое приближение), °С
  // Депрессии
  temperatureDepression: number;   // Δ' — температурная депрессия, °С
  hydrostaticDepression: number;   // Δ'' — гидростатическая депрессия, °С
  hydrodynamicDepression: number;  // Δ''' — гидродинамическая депрессия, °С
}

// Итоговые данные по батарее
export interface CalculationSummary {
  W_total_kgs: number;        // суммарное испарение, кг/с
  steamPressure: number;      // давление греющего пара, МПа
  condenserTemp: number;      // температура в барометрическом конденсаторе, °С
  sumDelta_prime: number;     // ΣΔ', °С
  sumDelta_double: number;    // ΣΔ'', °С
  sumDelta_triple: number;    // ΣΔ''', °С
  sumUsefulDeltaT: number;    // ΣΔtп (полезная), °С
}

// Одна строка промежуточного расчёта
export interface CalcStepRow {
  label: string;
  expr: string;
  result: string;
}

// Блок промежуточного расчёта (один шаг / одна формула)
export interface CalcStep {
  id: string;
  title: string;
  ref: string;       // ссылка на формулу из методики
  formula: string;   // формула в текстовом виде
  rows: CalcStepRow[];
}

// Сводные результаты расчёта батареи
export interface CalculationResult {
  id?: number;
  userId?: number;
  createdAt?: string;
  input: CalculationInput;
  stages: StageResult[];
  steps?: CalcStep[];
  totalEvaporatedWater: number;     // общее испарение, кг/ч
  totalSteamConsumption: number;    // расход греющего пара (D), кг/ч
  steamEconomy: number;             // паровая экономичность W/D
  totalHeatExchangeArea: number;    // общая площадь, м²
  averageHeatExchangeArea: number;  // средняя площадь, м²
  summary?: CalculationSummary;
}

// Запись о сохранённом расчёте
export interface CalculationRecord {
  id: number;
  userId: number;
  name: string;
  input: CalculationInput;
  result: CalculationResult;
  createdAt: string;
  updatedAt: string;
}

// Параметры для валидации
export interface ValidationRule {
  field: string;
  min: number;
  max: number;
  required: boolean;
}

// Ошибка валидации
export interface ValidationError {
  field: string;
  message: string;
}

// Настройки пользователя
export interface UserSettings {
  autoOptimizeEffects: boolean;
  maxEffects: number;
  temperatureTolerance: number;
  concentrationTolerance: number;
}
