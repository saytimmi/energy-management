"""Service layer for device operations."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from energy_management.models.device import Device, DeviceStatus, DeviceType


async def create_device(
    session: AsyncSession,
    name: str,
    device_type: DeviceType,
    location: str = "",
    rated_power_kw: float = 0.0,
) -> Device:
    device = Device(
        name=name,
        device_type=device_type,
        location=location,
        rated_power_kw=rated_power_kw,
    )
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return device


async def get_device(session: AsyncSession, device_id: int) -> Device | None:
    return await session.get(Device, device_id)


async def list_devices(
    session: AsyncSession,
    device_type: DeviceType | None = None,
    status: DeviceStatus | None = None,
) -> list[Device]:
    stmt = select(Device)
    if device_type:
        stmt = stmt.where(Device.device_type == device_type)
    if status:
        stmt = stmt.where(Device.status == status)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def update_device_status(
    session: AsyncSession, device_id: int, status: DeviceStatus
) -> Device | None:
    device = await session.get(Device, device_id)
    if device is None:
        return None
    device.status = status
    await session.commit()
    await session.refresh(device)
    return device
