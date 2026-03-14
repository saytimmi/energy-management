"""Tests for API endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from energy_management.app import app
from energy_management.database import get_session
from energy_management.models.base import Base


@pytest.fixture
async def client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    test_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with test_session() as ses:
            yield ses

    app.dependency_overrides[get_session] = override_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_create_and_list_devices(client):
    resp = await client.post(
        "/api/v1/devices",
        json={"name": "Test Device", "device_type": "consumer", "rated_power_kw": 1.5},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Device"
    device_id = data["id"]

    resp = await client.get("/api/v1/devices")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.get(f"/api/v1/devices/{device_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Device"


@pytest.mark.asyncio
async def test_device_not_found(client):
    resp = await client.get("/api/v1/devices/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_readings_workflow(client):
    device_resp = await client.post(
        "/api/v1/devices",
        json={"name": "Meter", "device_type": "consumer"},
    )
    device_id = device_resp.json()["id"]

    reading_resp = await client.post(
        "/api/v1/readings",
        json={"device_id": device_id, "power_kw": 2.5, "energy_kwh": 1.25},
    )
    assert reading_resp.status_code == 201

    readings_resp = await client.get(f"/api/v1/devices/{device_id}/readings")
    assert readings_resp.status_code == 200
    assert len(readings_resp.json()) == 1
