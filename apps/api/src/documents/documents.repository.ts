import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentFilter } from "./dto/list-documents.query.dto";

export type DocumentRecord = {
  id: string;
  title: string;
  ownerId: string;
  createdById: string;
  content: unknown[] | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentSummaryRecord = {
  id: string;
  title: string;
  updatedAt: Date;
  deletedAt: Date | null;
  favorited: boolean;
};

const DETAIL_SELECT = {
  id: true,
  title: true,
  ownerId: true,
  createdById: true,
  content: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DetailRow = {
  id: string;
  title: string;
  ownerId: string;
  createdById: string;
  content: unknown;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toRecord(row: DetailRow): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.ownerId,
    createdById: row.createdById,
    content: (row.content as unknown[] | null) ?? null,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string): Promise<DocumentRecord> {
    const row = await this.prisma.document.create({
      data: { ownerId: userId, createdById: userId },
      select: DETAIL_SELECT,
    });
    return toRecord(row);
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<DocumentRecord | null> {
    const row = await this.prisma.document.findFirst({
      where: { id, ownerId },
      select: DETAIL_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async isFavoritedBy(documentId: string, userId: string): Promise<boolean> {
    const favorite = await this.prisma.documentFavorite.findUnique({
      where: { userId_documentId: { userId, documentId } },
    });
    return favorite !== null;
  }

  async listForUser(userId: string, filter: DocumentFilter): Promise<DocumentSummaryRecord[]> {
    const rows = await this.prisma.document.findMany({
      where: {
        ownerId: userId,
        deletedAt: filter === DocumentFilter.TRASH ? { not: null } : null,
        ...(filter === DocumentFilter.FAVORITES ? { favorites: { some: { userId } } } : {}),
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        deletedAt: true,
        favorites: { where: { userId }, select: { userId: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      favorited: row.favorites.length > 0,
    }));
  }

  async updateTitle(id: string, ownerId: string, title: string): Promise<DocumentRecord | null> {
    const existing = await this.prisma.document.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    const row = await this.prisma.document.update({
      where: { id },
      data: { title },
      select: DETAIL_SELECT,
    });
    return toRecord(row);
  }

  async moveToTrash(id: string, ownerId: string): Promise<DocumentRecord | null> {
    const existing = await this.prisma.document.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    const row = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: DETAIL_SELECT,
    });
    return toRecord(row);
  }

  async restore(id: string, ownerId: string): Promise<DocumentRecord | null> {
    const existing = await this.prisma.document.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    const row = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: null },
      select: DETAIL_SELECT,
    });
    return toRecord(row);
  }

  async deletePermanently(id: string, ownerId: string): Promise<boolean> {
    const existing = await this.prisma.document.findFirst({
      where: { id, ownerId, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!existing) {
      return false;
    }
    await this.prisma.document.delete({ where: { id } });
    return true;
  }

  async addFavorite(documentId: string, userId: string): Promise<void> {
    await this.prisma.documentFavorite.upsert({
      where: { userId_documentId: { userId, documentId } },
      create: { userId, documentId },
      update: {},
    });
  }

  async removeFavorite(documentId: string, userId: string): Promise<void> {
    await this.prisma.documentFavorite.deleteMany({ where: { userId, documentId } });
  }
}
