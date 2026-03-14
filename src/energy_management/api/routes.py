"""API route definitions."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from energy_management.api.schemas import (
    ConsumptionSummaryResponse,
    CostEstimateResponse,
    DeviceCreate,
    DeviceResponse,
    DeviceStatusUpdate,
    ReadingCreate,
    ReadingResponse,
    TariffCreate,
    TariffResponse,
)
from energy_management.database import get_session
from energy_management.models.tariff import Tariff
from energy_management.services import analytics_service, device_service, reading_service

router = APIRouter()


# --- Devices ---


@router.post("/devices", response_model=DeviceResponse, status_code=201)
async def create_device(
    body: DeviceCreate, session: AsyncSession = Depends(get_session)
):
    return await device_service.create_device(
        session,
        name=body.name,
        device_type=body.device_type,
        location=body.location,
        rated_power_kw=body.rated_power_kw,
    )


@router.get("/devices", response_model=list[DeviceResponse])
async def list_devices(session: AsyncSession = Depends(get_session)):
    return await device_service.list_devices(session)


@router.get("/devices/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: int, session: AsyncSession = Depends(get_session)):
    device = await device_service.get_device(session, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.patch("/devices/{device_id}/status", response_model=DeviceResponse)
async def update_device_status(
    device_id: int,
    body: DeviceStatusUpdate,
    session: AsyncSession = Depends(get_session),
):
    device = await device_service.update_device_status(session, device_id, body.status)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


# --- Readings ---


@router.post("/readings", response_model=ReadingResponse, status_code=201)
async def create_reading(
    body: ReadingCreate, session: AsyncSession = Depends(get_session)
):
    return await reading_service.record_reading(
        session,
        device_id=body.device_id,
        power_kw=body.power_kw,
        energy_kwh=body.energy_kwh,
        timestamp=body.timestamp,
    )


@router.get("/devices/{device_id}/readings", response_model=list[ReadingResponse])
async def get_readings(
    device_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
):
    return await reading_service.get_readings(
        session, device_id, start=start, end=end, limit=limit
    )


# --- Tariffs ---


@router.post("/tariffs", response_model=TariffResponse, status_code=201)
async def create_tariff(
    body: TariffCreate, session: AsyncSession = Depends(get_session)
):
    tariff = Tariff(
        name=body.name,
        rate_per_kwh=body.rate_per_kwh,
        hour_start=body.hour_start,
        hour_end=body.hour_end,
    )
    session.add(tariff)
    await session.commit()
    await session.refresh(tariff)
    return tariff


# --- Analytics ---


@router.get(
    "/analytics/consumption/{device_id}",
    response_model=ConsumptionSummaryResponse,
)
async def consumption_summary(
    device_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    session: AsyncSession = Depends(get_session),
):
    summary = await analytics_service.get_consumption_summary(
        session, device_id, start=start, end=end
    )
    if summary is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return summary


@router.get("/analytics/cost/{device_id}", response_model=CostEstimateResponse)
async def cost_estimate(
    device_id: int,
    tariff_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    session: AsyncSession = Depends(get_session),
):
    estimate = await analytics_service.estimate_cost(
        session, device_id, tariff_id, start=start, end=end
    )
    if estimate is None:
        raise HTTPException(status_code=404, detail="Tariff not found")
    return estimate
