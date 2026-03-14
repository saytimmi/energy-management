"""Tests for analytics service."""

import pytest

from energy_management.models.device import DeviceType
from energy_management.models.tariff import Tariff
from energy_management.services.analytics_service import (
    estimate_cost,
    get_consumption_summary,
)
from energy_management.services.device_service import create_device
from energy_management.services.reading_service import record_reading


@pytest.mark.asyncio
async def test_consumption_summary(session):
    device = await create_device(session, name="Lamp", device_type=DeviceType.CONSUMER)
    await record_reading(session, device.id, power_kw=0.1, energy_kwh=0.05)
    await record_reading(session, device.id, power_kw=0.2, energy_kwh=0.10)

    summary = await get_consumption_summary(session, device.id)
    assert summary is not None
    assert summary.total_energy_kwh == pytest.approx(0.15)
    assert summary.peak_power_kw == pytest.approx(0.2)
    assert summary.reading_count == 2


@pytest.mark.asyncio
async def test_estimate_cost(session):
    device = await create_device(session, name="Oven", device_type=DeviceType.CONSUMER)
    await record_reading(session, device.id, power_kw=3.0, energy_kwh=1.5)
    await record_reading(session, device.id, power_kw=3.0, energy_kwh=1.5)

    tariff = Tariff(name="Standard", rate_per_kwh=0.12)
    session.add(tariff)
    await session.commit()
    await session.refresh(tariff)

    result = await estimate_cost(session, device.id, tariff.id)
    assert result is not None
    assert result.total_energy_kwh == pytest.approx(3.0)
    assert result.total_cost == pytest.approx(0.36)


@pytest.mark.asyncio
async def test_consumption_summary_no_device(session):
    result = await get_consumption_summary(session, 9999)
    assert result is None
