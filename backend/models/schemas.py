from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class VideoProcessRequest(BaseModel):
    url: Optional[str] = None
    min_duration: int = 30
    max_duration: int = 60
    clip_count: int = 5
    add_subtitles: bool = True
    reframe_vertical: bool = True
    subtitle_style: str = 'default'

class ClipResult(BaseModel):
    id: Optional[int] = None
    title: str
    start_time: float
    end_time: float
    duration: float
    transcript: str
    virality_score: float
    output_path: str
    campaign_id: Optional[int] = None
    campaign_match_score: Optional[float] = None

class ProcessingStatus(BaseModel):
    job_id: str
    status: str
    progress: float
    message: str
    step: Optional[str] = "download"
    clips: List[ClipResult] = []

class CampaignCreate(BaseModel):
    name: str
    description: str
    keywords: str
    platform: str
    requirements: str
    min_duration: int = 15
    max_duration: int = 60

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[str] = None
    platform: Optional[str] = None
    requirements: Optional[str] = None
    min_duration: Optional[int] = None
    max_duration: Optional[int] = None
    status: Optional[str] = None

class CampaignResponse(BaseModel):
    id: int
    name: str
    description: str
    keywords: str
    platform: str
    status: str
    requirements: str
    min_duration: int
    max_duration: int
    created_at: datetime
    updated_at: datetime
    clip_count: int = 0

    class Config:
        from_attributes = True

class ClipCampaignAssignment(BaseModel):
    clip_id: int
    campaign_id: int
    match_score: float
    reason: str
