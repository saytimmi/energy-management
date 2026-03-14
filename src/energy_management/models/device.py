"""Device model for tracked energy consumers/producers."""

import enum

from sqlalchemy import Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from energy_management.models.base import Base


class DeviceType(str, enum.Enum):
    CONSUMER = "consumer"
    PRODUCER = "producer"
    STORAGE = "storage"


class DeviceStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


class Device(Base):
    __tablename__ = "devices"

    name: Mapped[str] = mapped_column(String(255))
    location: Mapped[str] = mapped_column(String(255), default="")
    device_type: Mapped[DeviceType] = mapped_column(Enum(DeviceType))
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus), default=DeviceStatus.ACTIVE
    )
    rated_power_kw: Mapped[float] = mapped_column(Float, default=0.0)

    readings = relationship("EnergyReading", back_populates="device", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Device {self.name} ({self.device_type.value})>"
