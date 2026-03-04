from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_date: Mapped[str] = mapped_column(String, index=True)
    publication_date: Mapped[str] = mapped_column(String, index=True)
    total_tenders: Mapped[int] = mapped_column(Integer, default=0)
    relevant_tenders: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    analyses: Mapped[list["TenderAnalysis"]] = relationship(
        "TenderAnalysis", back_populates="run", cascade="all, delete-orphan"
    )


class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    pdf_link: Mapped[str] = mapped_column(Text, nullable=False)
    first_seen_publication_date: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    analyses: Mapped[list["TenderAnalysis"]] = relationship(
        "TenderAnalysis", back_populates="tender", cascade="all, delete-orphan"
    )


class TenderAnalysis(Base):
    __tablename__ = "tender_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), nullable=False)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id"), nullable=False)
    analysis: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    run: Mapped[Run] = relationship("Run", back_populates="analyses")
    tender: Mapped[Tender] = relationship("Tender", back_populates="analyses")
