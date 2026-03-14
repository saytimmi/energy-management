"""Energy reading model for time-series consumption/production data."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from energy_management.models.base import Base


class EnergyReading(Base):
    __tablename__ = "energy_readings"

    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    power_kw: Mapped[float] = mapped_column(Float)
    energy_kwh: Mapped[float] = mapped_column(Float, default=0.0)

    device = relationship("Device", back_populates="readings")

    def __repr__(self) -> str:
        return f"<EnergyReading device={self.device_id} power={self.power_kw}kW>"
