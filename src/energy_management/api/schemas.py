"""Pydantic schemas for API request/response validation."""

from datetime import datetime

from pydantic import BaseModel

from energy_management.models.device import DeviceStatus, DeviceType


class DeviceCreate(BaseModel):
    name: str
    device_type: DeviceType
    location: str = ""
    rated_power_kw: float = 0.0


class DeviceResponse(BaseModel):
    id: int
    name: str
    device_type: DeviceType
    status: DeviceStatus
    location: str
    rated_power_kw: float
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceStatusUpdate(BaseModel):
    status: DeviceStatus


class ReadingCreate(BaseModel):
    device_id: int
    power_kw: float
    energy_kwh: float = 0.0
    timestamp: datetime | None = None


class ReadingResponse(BaseModel):
    id: int
    device_id: int
    power_kw: float
    energy_kwh: float
    timestamp: datetime

    model_config = {"from_attributes": True}


class TariffCreate(BaseModel):
    name: str
    rate_per_kwh: float
    hour_start: int = 0
    hour_end: int = 24


class TariffResponse(BaseModel):
    id: int
    name: str
    rate_per_kwh: float
    hour_start: int
    hour_end: int

    model_config = {"from_attributes": True}


class ConsumptionSummaryResponse(BaseModel):
    device_id: int
    device_name: str
    total_energy_kwh: float
    avg_power_kw: float
    peak_power_kw: float
    reading_count: int


class CostEstimateResponse(BaseModel):
    total_energy_kwh: float
    total_cost: float
    tariff_name: str
