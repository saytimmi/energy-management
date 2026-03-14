"""Tests for device service."""

import pytest

from energy_management.models.device import DeviceStatus, DeviceType
from energy_management.services.device_service import (
    create_device,
    get_device,
    list_devices,
    update_device_status,
)


@pytest.mark.asyncio
async def test_create_and_get_device(session):
    device = await create_device(
        session, name="Solar Panel A", device_type=DeviceType.PRODUCER, rated_power_kw=5.0
    )
    assert device.id is not None
    assert device.name == "Solar Panel A"
    assert device.device_type == DeviceType.PRODUCER
    assert device.status == DeviceStatus.ACTIVE

    fetched = await get_device(session, device.id)
    assert fetched is not None
    assert fetched.name == "Solar Panel A"


@pytest.mark.asyncio
async def test_list_devices_with_filter(session):
    await create_device(session, name="Heater", device_type=DeviceType.CONSUMER)
    await create_device(session, name="Solar", device_type=DeviceType.PRODUCER)

    consumers = await list_devices(session, device_type=DeviceType.CONSUMER)
    assert len(consumers) == 1
    assert consumers[0].name == "Heater"

    all_devices = await list_devices(session)
    assert len(all_devices) == 2


@pytest.mark.asyncio
async def test_update_device_status(session):
    device = await create_device(session, name="AC Unit", device_type=DeviceType.CONSUMER)
    updated = await update_device_status(session, device.id, DeviceStatus.MAINTENANCE)
    assert updated is not None
    assert updated.status == DeviceStatus.MAINTENANCE


@pytest.mark.asyncio
async def test_get_nonexistent_device(session):
    result = await get_device(session, 9999)
    assert result is None
