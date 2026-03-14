"""Tests for reading service."""

import pytest

from energy_management.models.device import DeviceType
from energy_management.services.device_service import create_device
from energy_management.services.reading_service import get_readings, record_reading


@pytest.mark.asyncio
async def test_record_and_get_readings(session):
    device = await create_device(session, name="Meter", device_type=DeviceType.CONSUMER)

    r1 = await record_reading(session, device.id, power_kw=1.5, energy_kwh=0.75)
    r2 = await record_reading(session, device.id, power_kw=2.0, energy_kwh=1.0)

    assert r1.id is not None
    assert r2.power_kw == 2.0

    readings = await get_readings(session, device.id)
    assert len(readings) == 2
