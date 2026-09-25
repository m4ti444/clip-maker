from datetime import datetime
from typing import AsyncGenerator
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship

try:
    from backend.config import settings
except ImportError:
    from config import settings

Base = declarative_base()

class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    keywords = Column(Text) # comma separated
    platform = Column(String) # whop, pearpop, manual
    status = Column(String, default='active')
    requirements = Column(Text)
    min_duration = Column(Integer)
    max_duration = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    clips = relationship("Clip", back_populates="campaign")

class Clip(Base):
    __tablename__ = "clips"
    
    id = Column(Integer, primary_key=True, index=True)
    video_source = Column(String)
    title = Column(String)
    start_time = Column(Float)
    end_time = Column(Float)
    duration = Column(Float)
    transcript = Column(Text)
    virality_score = Column(Float)
    output_path = Column(String)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    campaign_match_score = Column(Float, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    campaign = relationship("Campaign", back_populates="clips")

engine = create_async_engine(settings.DB_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
