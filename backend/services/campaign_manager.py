from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from backend.models.schemas import CampaignCreate, CampaignUpdate
from backend.database.db import Campaign, Clip
import json

class CampaignManager:
    async def create_campaign(self, db: AsyncSession, data: CampaignCreate) -> Campaign:
        new_camp = Campaign(**data.model_dump())
        db.add(new_camp)
        await db.commit()
        await db.refresh(new_camp)
        return new_camp

    async def get_campaigns(self, db: AsyncSession, status: str = None) -> list[Campaign]:
        query = select(Campaign)
        if status:
            query = query.where(Campaign.status == status)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_campaign(self, db: AsyncSession, campaign_id: int) -> Campaign:
        result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        return result.scalars().first()

    async def update_campaign(self, db: AsyncSession, campaign_id: int, data: CampaignUpdate) -> Campaign:
        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            await db.execute(update(Campaign).where(Campaign.id == campaign_id).values(**update_data))
            await db.commit()
        return await self.get_campaign(db, campaign_id)

    async def delete_campaign(self, db: AsyncSession, campaign_id: int) -> bool:
        result = await db.execute(delete(Campaign).where(Campaign.id == campaign_id))
        await db.commit()
        return result.rowcount > 0

    async def classify_clips(self, clips: list[dict], campaigns: list[Campaign]) -> list[dict]:
        # Very simple keyword matching for illustration
        enriched = []
        for clip in clips:
            best_score = 0.0
            best_camp = None
            text = (clip.get("transcript", "") + " " + clip.get("title", "")).lower()
            
            for camp in campaigns:
                keywords = [k.strip().lower() for k in camp.keywords.split(',')] if camp.keywords else []
                match_count = sum(1 for k in keywords if k in text)
                score = (match_count / max(len(keywords), 1)) * 100
                if score > best_score:
                    best_score = score
                    best_camp = camp.id

            new_clip = clip.copy()
            if best_camp and best_score > 10:
                new_clip["campaign_id"] = best_camp
                new_clip["campaign_match_score"] = best_score
            enriched.append(new_clip)
        return enriched

    async def get_campaign_clips(self, db: AsyncSession, campaign_id: int) -> list[Clip]:
        result = await db.execute(select(Clip).where(Clip.campaign_id == campaign_id))
        return list(result.scalars().all())

campaign_manager_service = CampaignManager()
