-- ================================================================
-- Схема базы данных для himia-11klass
-- PostgreSQL 14+
--
-- Применение:
--   psql -U postgres -d himia_db -f db/schema.sql
-- ================================================================

-- Расширение для UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Пользователи ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Товары (каталог) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255)    NOT NULL,
  description TEXT,
  price       DECIMAL(10,2)   NOT NULL,
  image       TEXT,
  category    VARCHAR(100),
  created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ── Проекты расчётов выпарных батарей ────────────────────────────
CREATE TABLE IF NOT EXISTS calculation_projects (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                     VARCHAR(255) NOT NULL,
  evaporator_type          VARCHAR(50)  NOT NULL,
  flow_direction           VARCHAR(50)  NOT NULL,
  number_of_effects        INTEGER      NOT NULL,
  feed_flow_rate           NUMERIC(12,3) NOT NULL,
  initial_concentration    NUMERIC(5,2)  NOT NULL,
  final_concentration      NUMERIC(5,2)  NOT NULL,
  steam_temperature        NUMERIC(6,2)  NOT NULL,
  heat_transfer_coefficient NUMERIC(8,2) NOT NULL,
  vaporization_heat        NUMERIC(8,2)  NOT NULL,
  condensation_heat        NUMERIC(8,2)  NOT NULL,
  pressure_loss            NUMERIC(8,4),
  vacuum_pressure          NUMERIC(8,4),
  created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calc_projects_user ON calculation_projects(user_id);

-- ── Результаты расчётов (по корпусам) ────────────────────────────
CREATE TABLE IF NOT EXISTS calculation_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID         NOT NULL REFERENCES calculation_projects(id) ON DELETE CASCADE,
  stage_number      INTEGER      NOT NULL,
  temperature       NUMERIC(6,2)  NOT NULL,
  pressure          NUMERIC(8,4)  NOT NULL,
  feed_flow_rate    NUMERIC(12,3) NOT NULL,
  evaporated_water  NUMERIC(12,3) NOT NULL,
  concentration_in  NUMERIC(5,2)  NOT NULL,
  concentration_out NUMERIC(5,2)  NOT NULL,
  steam_consumption NUMERIC(12,3) NOT NULL,
  heat_exchange_area NUMERIC(10,2) NOT NULL,
  heat_load         NUMERIC(10,2) NOT NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calc_results_project ON calculation_results(project_id);

-- ── Справочные таблицы ───────────────────────────────────────────
-- headers и rows хранятся как JSON-массивы (JSONB)
-- group_id  — общий идентификатор для листов одного Excel-файла
-- group_name — название группы (имя файла), редактируемое
CREATE TABLE IF NOT EXISTS reference_tables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  source_image TEXT,
  group_id   VARCHAR(500),
  group_name VARCHAR(255),
  headers    JSONB        NOT NULL DEFAULT '[]',
  rows       JSONB        NOT NULL DEFAULT '[]',
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_tables_user  ON reference_tables(user_id);
CREATE INDEX IF NOT EXISTS idx_ref_tables_group ON reference_tables(group_id);

-- ── Триггер автообновления updated_at ───────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calc_projects_updated_at') THEN
    CREATE TRIGGER trg_calc_projects_updated_at
      BEFORE UPDATE ON calculation_projects
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ref_tables_updated_at') THEN
    CREATE TRIGGER trg_ref_tables_updated_at
      BEFORE UPDATE ON reference_tables
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

-- ── Начальные данные ─────────────────────────────────────────────
-- Пароль: admin123  (bcrypt, 10 rounds)
-- Замените хэш на свой при деплое: SELECT crypt('ваш_пароль', gen_salt('bf',10));
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$placeholder_replace_with_real_hash', 'admin')
ON CONFLICT (username) DO NOTHING;
