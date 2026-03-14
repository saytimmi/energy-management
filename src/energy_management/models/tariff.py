"""Tariff model for energy pricing schedules."""

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from energy_management.models.base import Base


class Tariff(Base):
    __tablename__ = "tariffs"

    name: Mapped[str] = mapped_column(String(255))
    rate_per_kwh: Mapped[float] = mapped_column(Float)
    hour_start: Mapped[int] = mapped_column(Integer, default=0)
    hour_end: Mapped[int] = mapped_column(Integer, default=24)

    def __repr__(self) -> str:
        return f"<Tariff {self.name} {self.rate_per_kwh}/kWh>"

    def applies_at_hour(self, hour: int) -> bool:
        return self.hour_start <= hour < self.hour_end
