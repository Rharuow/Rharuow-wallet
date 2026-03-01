import { prisma } from '../../lib/prisma'
import type { UpdateUserInput } from './users.schema'

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function updateUser(id: string, input: UpdateUserInput) {
  return prisma.user.update({
    where: { id },
    data: input,
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
      updatedAt: true,
    },
  })
}
