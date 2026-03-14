"""Service layer for energy reading operations."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from energy_management.models.reading import EnergyReading


async def record_reading(
    session: AsyncSession,
    device_id: int,
    power_kw: float,
    energy_kwh: float = 0.0,
    timestamp: datetime | None = None,
) -> EnergyReading:
    reading = EnergyReading(
        device_id=device_id,
        power_kw=power_kw,
        energy_kwh=energy_kwh,
    )
    if timestamp:
        reading.timestamp = timestamp
    session.add(reading)
    await session.commit()
    await session.refresh(reading)
    return reading


async def get_readings(
    session: AsyncSession,
    device_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 100,
) -> list[EnergyReading]:
    stmt = (
        select(EnergyReading)
        .where(EnergyReading.device_id == device_id)
        .order_by(EnergyReading.timestamp.desc())
        .limit(limit)
    )
    if start:
        stmt = stmt.where(EnergyReading.timestamp >= start)
    if end:
        stmt = stmt.where(EnergyReading.timestamp <= end)
    result = await session.execute(stmt)
    return list(result.scalars().all())
