"""Analytics service for energy consumption insights."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from energy_management.models.device import Device, DeviceType
from energy_management.models.reading import EnergyReading
from energy_management.models.tariff import Tariff


@dataclass
class ConsumptionSummary:
    device_id: int
    device_name: str
    total_energy_kwh: float
    avg_power_kw: float
    peak_power_kw: float
    reading_count: int


@dataclass
class CostEstimate:
    total_energy_kwh: float
    total_cost: float
    tariff_name: str


async def get_consumption_summary(
    session: AsyncSession,
    device_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
) -> ConsumptionSummary | None:
    device = await session.get(Device, device_id)
    if device is None:
        return None

    stmt = select(
        func.sum(EnergyReading.energy_kwh),
        func.avg(EnergyReading.power_kw),
        func.max(EnergyReading.power_kw),
        func.count(EnergyReading.id),
    ).where(EnergyReading.device_id == device_id)

    if start:
        stmt = stmt.where(EnergyReading.timestamp >= start)
    if end:
        stmt = stmt.where(EnergyReading.timestamp <= end)

    result = await session.execute(stmt)
    row = result.one()

    return ConsumptionSummary(
        device_id=device_id,
        device_name=device.name,
        total_energy_kwh=row[0] or 0.0,
        avg_power_kw=row[1] or 0.0,
        peak_power_kw=row[2] or 0.0,
        reading_count=row[3] or 0,
    )


async def get_total_consumption(
    session: AsyncSession,
    start: datetime | None = None,
    end: datetime | None = None,
) -> float:
    stmt = select(func.sum(EnergyReading.energy_kwh)).join(Device).where(
        Device.device_type == DeviceType.CONSUMER
    )
    if start:
        stmt = stmt.where(EnergyReading.timestamp >= start)
    if end:
        stmt = stmt.where(EnergyReading.timestamp <= end)
    result = await session.execute(stmt)
    return result.scalar() or 0.0


async def estimate_cost(
    session: AsyncSession,
    device_id: int,
    tariff_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
) -> CostEstimate | None:
    tariff = await session.get(Tariff, tariff_id)
    if tariff is None:
        return None

    stmt = select(func.sum(EnergyReading.energy_kwh)).where(
        EnergyReading.device_id == device_id
    )
    if start:
        stmt = stmt.where(EnergyReading.timestamp >= start)
    if end:
        stmt = stmt.where(EnergyReading.timestamp <= end)

    result = await session.execute(stmt)
    total_kwh = result.scalar() or 0.0

    return CostEstimate(
        total_energy_kwh=total_kwh,
        total_cost=total_kwh * tariff.rate_per_kwh,
        tariff_name=tariff.name,
    )
