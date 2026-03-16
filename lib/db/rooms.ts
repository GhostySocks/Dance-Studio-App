import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getRooms({
  search,
  page = 1,
  perPage = 10,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.RoomWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const [rooms, total] = await Promise.all([
    prisma.room.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.room.count({ where }),
  ]);

  return { rooms, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllRooms() {
  return prisma.room.findMany({ orderBy: { name: "asc" } });
}

export async function getRoomById(id: string) {
  return prisma.room.findUnique({
    where: { id },
    include: {
      sessions: {
        include: {
          template: { select: { name: true, danceStyle: true } },
          teacher: { select: { user: { select: { name: true } } } },
          enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
        },
        orderBy: { startTime: "desc" },
        take: 20,
      },
    },
  });
}

export async function createRoom(data: {
  name: string;
  description?: string | null;
  capacity: number;
}) {
  return prisma.room.create({ data });
}

export async function updateRoom(id: string, data: {
  name?: string;
  description?: string | null;
  capacity?: number;
}) {
  return prisma.room.update({ where: { id }, data });
}

export async function deleteRoom(id: string) {
  return prisma.room.delete({ where: { id } });
}

export async function checkRoomConflict(roomId: string, startTime: Date, endTime: Date, excludeSessionId?: string) {
  const where: Prisma.ClassSessionWhereInput = {
    roomId,
    AND: [
      { startTime: { lt: endTime } },
      { endTime: { gt: startTime } },
    ],
  };
  if (excludeSessionId) {
    where.id = { not: excludeSessionId };
  }
  const conflict = await prisma.classSession.findFirst({ where });
  return conflict !== null;
}
