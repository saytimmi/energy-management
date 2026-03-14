# Energy Management System

A system for monitoring and optimizing energy consumption across devices, with support for consumption tracking, tariff-based cost estimation, and analytics.

## Features

- **Device Management** — Register and track energy consumers, producers, and storage devices
- **Energy Readings** — Record time-series power and energy measurements per device
- **Tariff Management** — Define time-of-use pricing schedules
- **Analytics** — Consumption summaries, peak power tracking, and cost estimation
- **REST API** — Full CRUD via FastAPI with async SQLAlchemy backend

## Quick Start

```bash
pip install -e ".[dev]"
uvicorn energy_management.app:app --reload
```

API docs available at `http://localhost:8000/docs`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/devices` | Create a device |
| GET | `/api/v1/devices` | List all devices |
| GET | `/api/v1/devices/{id}` | Get device by ID |
| PATCH | `/api/v1/devices/{id}/status` | Update device status |
| POST | `/api/v1/readings` | Record an energy reading |
| GET | `/api/v1/devices/{id}/readings` | Get readings for a device |
| POST | `/api/v1/tariffs` | Create a tariff |
| GET | `/api/v1/analytics/consumption/{id}` | Consumption summary |
| GET | `/api/v1/analytics/cost/{id}?tariff_id=N` | Cost estimate |

## Configuration

Environment variables (prefix `EMS_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `EMS_DATABASE_URL` | `sqlite+aiosqlite:///./energy.db` | Database connection string |
| `EMS_DEBUG` | `false` | Enable debug mode |

## Testing

```bash
pytest
```
