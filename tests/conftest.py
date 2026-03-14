"""Shared test fixtures."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from energy_management.models.base import Base


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_ses = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_ses() as ses:
        yield ses

    await engine.dispose()
