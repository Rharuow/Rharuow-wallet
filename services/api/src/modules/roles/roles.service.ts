import { prisma } from '../../lib/prisma'
import type { CreateRoleInput, UpdateRoleInput } from './roles.schema'

export async function createRole(input: CreateRoleInput) {
  const existing = await prisma.role.findUnique({
    where: { name: input.name },
  })

  if (existing) {
    const error = new Error('Role já existe') as Error & { statusCode: number }
    error.statusCode = 409
    throw error
  }

  return prisma.role.create({
    data: { name: input.name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })
}

export async function listRoles() {
  return prisma.role.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getRoleById(id: string) {
  return prisma.role.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } },
    },
  })
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) {
    const error = new Error('Role não encontrada') as Error & {
      statusCode: number
    }
    error.statusCode = 404
    throw error
  }

  return prisma.role.update({
    where: { id },
    data: { name: input.name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })

  if (!role) {
    const error = new Error('Role não encontrada') as Error & {
      statusCode: number
    }
    error.statusCode = 404
    throw error
  }

  if (role._count.users > 0) {
    const error = new Error(
      'Role não pode ser excluída pois possui usuários associados',
    ) as Error & { statusCode: number }
    error.statusCode = 409
    throw error
  }

  await prisma.role.delete({ where: { id } })
}
