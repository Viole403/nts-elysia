import { prisma } from '../../lib/prisma';
import { GroupVisibility, GroupMemberRole } from '@prisma/client';
import { redisPublisher } from '../../plugins/redis.plugin';

export class GroupService {
  static async create(data: { name: string; description?: string; visibility?: GroupVisibility; creatorId: string }) {
    const filters = { visibility: visibility as GroupVisibility, creatorId };
    const group = await prisma.group.create({
      data: {
        name,
        description,
        visibility,
        members: {
          create: {
            userId: creatorId,
            role: GroupMemberRole.ADMIN, // Creator is automatically an admin
          },
        },
      },
    });
    return group;
  }

  static async findAll(filters: { visibility?: GroupVisibility; creatorId?: string }, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters.visibility) {
      where.visibility = filters.visibility;
    }
    if (filters.creatorId) {
      where.members = {
        some: {
          userId: filters.creatorId,
          role: GroupMemberRole.ADMIN, // Assuming creator is an admin of the group
        },
      };
    }

    const skip = (page - 1) * limit;

    const groups = await prisma.group.findMany({
      where,
      skip,
      take: limit,
      include: { members: true },
    });
    const total = await prisma.group.count({ where });
    return { groups, total, page, limit };
  }

  static async findOne(id: string) {
    return prisma.group.findUnique({
      where: { id },
      include: { members: true, posts: true },
    });
  }

  static async update(id: string, data: { name?: string; description?: string; visibility?: GroupVisibility }) {
    return prisma.group.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return prisma.group.delete({
      where: { id },
    });
  }

  static async joinGroup(groupId: string, userId: string) {
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (existingMembership) {
      throw new Error('Already a member of this group.');
    }

    return prisma.groupMembership.create({
      data: {
        groupId,
        userId,
        role: GroupMemberRole.MEMBER,
      },
    });
  }

  static async leaveGroup(groupId: string, userId: string) {
    return prisma.groupMembership.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });
  }

  static async updateMemberRole(groupId: string, userId: string, role: GroupMemberRole) {
    return prisma.groupMembership.update({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      data: { role },
    });
  }

  // Nested Group Post Service
  static GroupPosts = {
    create: async (groupId: string, authorId: string, content: string) => {
      const membership = await prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: authorId,
          },
        },
      });

      if (!membership) {
        throw new Error('User is not a member of this group.');
      }

      const post = await prisma.groupPost.create({
        data: {
          groupId,
          authorId,
          content,
        },
      });

      await redisPublisher.publish(
        `group:${groupId}:posts`,
        JSON.stringify({ type: 'NEW_POST', post })
      );

      return post;
    },

    findAll: async (groupId: string, filters: { authorId?: string }, page: number = 1, limit: number = 10) => {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new Error('Group not found.');
      }

      const where: any = {
        groupId,
      };
      if (filters.authorId) {
        where.authorId = filters.authorId;
      }

      const skip = (page - 1) * limit;

      const posts = await prisma.groupPost.findMany({
        where,
        skip,
        take: limit,
        include: { author: { select: { id: true, username: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const total = await prisma.groupPost.count({ where });
      return { posts, total, page, limit };
    },

    findOne: async (groupId: string, postId: string) => {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new Error('Group not found.');
      }

      return prisma.groupPost.findUnique({
        where: { id: postId, groupId },
        include: { author: { select: { id: true, username: true, email: true } } },
      });
    },

    update: async (groupId: string, postId: string, content: string) => {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new Error('Group not found.');
      }

      const updatedPost = await prisma.groupPost.update({
        where: { id: postId, groupId },
        data: { content },
      });

      await redisPublisher.publish(
        `group:${groupId}:posts`,
        JSON.stringify({ type: 'UPDATED_POST', post: updatedPost })
      );

      return updatedPost;
    },

    delete: async (groupId: string, postId: string) => {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new Error('Group not found.');
      }

      const deletedPost = await prisma.groupPost.delete({
        where: { id: postId, groupId },
      });

      await redisPublisher.publish(
        `group:${groupId}:posts`,
        JSON.stringify({ type: 'DELETED_POST', postId })
      );

      return deletedPost;
    },
  };
}