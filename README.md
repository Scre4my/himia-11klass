# Магазин товаров с Docker

## Быстрый старт

### Запуск в Docker (рекомендуется)

```bash
docker-compose up -d
```

Приложение будет доступно по адресу:
- Фронтенд: http://localhost:3000
- Бэкенд API: http://localhost:5000

### Локальная разработка

#### Бэкенд
```bash
cd server
npm install
npm start
```

#### Фронтенд
```bash
npm install
npm start
```

## API Endpoints

- `GET /api/products` - получить все товары
- `GET /api/products/:id` - получить товар по ID
- `POST /api/products` - создать товар
- `PUT /api/products/:id` - обновить товар
- `DELETE /api/products/:id` - удалить товар

## Структура проекта

```
├── server/           # Бэкенд (Node.js + Express)
├── src/              # Фронтенд (React)
├── docker-compose.yml
├── Dockerfile.client # Фронтенд Dockerfile
└── nginx.conf        # Nginx конфигурация
```

## Переменные окружения

### Сервер
- `PORT` - порт сервера (по умолчанию 5000)
- `DB_HOST` - хост PostgreSQL
- `DB_PORT` - порт PostgreSQL (по умолчанию 5432)
- `DB_USER` - пользователь БД
- `DB_PASSWORD` - пароль БД
- `DB_NAME` - имя базы данных

### Клиент
- `REACT_APP_API_URL` - URL API (по умолчанию http://localhost:5000/api)
