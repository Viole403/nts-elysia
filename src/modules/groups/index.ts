import { Elysia, Context, t } from 'elysia';
import { GroupService } from './service';
import { createGroupSchema, updateGroupSchema, getGroupsQuerySchema, updateGroupMemberRoleSchema, createGroupPostSchema, updateGroupPostSchema, getGroupPostsQuerySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole, GroupMemberRole, GroupVisibility } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class GroupController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return GroupService.create({ ...ctx.body, creatorId: ctx.user.id });
  }

  static async findAll(ctx: Context) {
    const { visibility, creatorId, page, limit } = ctx.query; // Added missing page and limit
    const filters = { visibility: visibility as GroupVisibility, creatorId };
    return GroupService.findAll(filters, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOne(ctx: Context) {
    return GroupService.findOne(ctx.params.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const group = await GroupService.findOne(ctx.params.id);
    if (!group) {
      ctx.set.status = 404;
      return { message: 'Group not found' };
    }
    // Check if user is admin of the group or platform admin
    const isAdminOfGroup = group.members.some(member => member.userId === ctx.user?.id && member.role === GroupMemberRole.ADMIN);
    if (!isAdminOfGroup && ctx.user?.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update groups you administer.' };
    }
    return GroupService.update(ctx.params.id, ctx.body);
  }

  static async delete(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const group = await GroupService.findOne(ctx.params.id);
    if (!group) {
      ctx.set.status = 404;
      return { message: 'Group not found' };
    }
    const isAdminOfGroup = group.members.some(member => member.userId === ctx.user?.id && member.role === GroupMemberRole.ADMIN);
    if (!isAdminOfGroup && ctx.user?.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete groups you administer.' };
    }
    return GroupService.delete(ctx.params.id);
  }

  static async joinGroup(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return GroupService.joinGroup(ctx.params.id, ctx.user.id);
  }

  static async leaveGroup(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return GroupService.leaveGroup(ctx.params.id, ctx.user.id);
  }

  static async updateMemberRole(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const group = await GroupService.findOne(ctx.params.id);
    if (!group) {
      ctx.set.status = 404;
      return { message: 'Group not found' };
    }
    const isAdminOfGroup = group.members.some(member => member.userId === ctx.user?.id && (member.role === GroupMemberRole.ADMIN || member.role === GroupMemberRole.MEMBER));
    if (!isAdminOfGroup && ctx.user?.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: Only group admins or platform admins can change member roles.' };
    }
    return GroupService.updateMemberRole(ctx.params.id, ctx.params.userId, ctx.body.role);
  }

  // Group Post Controllers
  static async createPost(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    // Use 'id' instead of 'groupId' to match the route parameter
    const { id: groupId } = ctx.params;

    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: ctx.user.id,
        },
      },
    });

    if (!membership) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You must be a member to post in this group.' };
    }

    return GroupService.GroupPosts.create(groupId, ctx.user.id, ctx.body.content);
  }

  static async findAllPosts(ctx: Context) {
    // Use 'id' instead of 'groupId' to match the route parameter
    const { id: groupId } = ctx.params;
    const { authorId, page, limit } = ctx.query;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      ctx.set.status = 404;
      return { message: 'Group not found.' };
    }

    if (group.visibility === GroupVisibility.PRIVATE) {
      if (!ctx.user || !ctx.user.id) {
        ctx.set.status = 401;
        return { message: 'Unauthorized: This is a private group.' };
      }
      const membership = await prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: ctx.user.id,
          },
        },
      });
      if (!membership) {
        ctx.set.status = 403;
        return { message: 'Forbidden: You are not a member of this private group.' };
      }
    }

    return GroupService.GroupPosts.findAll(groupId, { authorId }, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOnePost(ctx: Context) {
    // Use 'id' instead of 'groupId' to match the route parameter
    const { id: groupId, postId } = ctx.params;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      ctx.set.status = 404;
      return { message: 'Group not found.' };
    }

    if (group.visibility === GroupVisibility.PRIVATE) {
      if (!ctx.user || !ctx.user.id) {
        ctx.set.status = 401;
        return { message: 'Unauthorized: This is a private group.' };
      }
      const membership = await prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: ctx.user.id,
          },
        },
      });
      if (!membership) {
        ctx.set.status = 403;
        return { message: 'Forbidden: You are not a member of this private group.' };
      }
    }

    return GroupService.GroupPosts.findOne(groupId, postId);
  }

  static async updatePost(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    // Use 'id' instead of 'groupId' to match the route parameter
    const { id: groupId, postId } = ctx.params;
    const post = await GroupService.GroupPosts.findOne(groupId, postId);
    if (!post) {
      ctx.set.status = 404;
      return { message: 'Group post not found' };
    }

    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
    const isGroupAdminOrModerator = group?.members.some(member =>
      member.userId === ctx.user?.id && (member.role === GroupMemberRole.ADMIN || member.role === GroupMemberRole.MEMBER)
    );

    if (ctx.user.id !== post.authorId && !isGroupAdminOrModerator && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own posts or if you are an admin/moderator.' };
    }

    return GroupService.GroupPosts.update(groupId, postId, ctx.body.content);
  }

  static async deletePost(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    // Use 'id' instead of 'groupId' to match the route parameter
    const { id: groupId, postId } = ctx.params;
    const post = await GroupService.GroupPosts.findOne(groupId, postId);
    if (!post) {
      ctx.set.status = 404;
      return { message: 'Group post not found' };
    }

    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
    const isGroupAdminOrModerator = group?.members.some(member =>
      member.userId === ctx.user?.id && (member.role === GroupMemberRole.ADMIN || member.role === GroupMemberRole.MEMBER)
    );

    if (ctx.user.id !== post.authorId && !isGroupAdminOrModerator && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete your own posts or if you are an admin/moderator.' };
    }

    return GroupService.GroupPosts.delete(groupId, postId);
  }
}

export const groupModule = new Elysia()
  .use(authPlugin)
  .group('/groups', (app) =>
    app
      .post('/', GroupController.create, {
        body: createGroupSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/', GroupController.findAll, { query: getGroupsQuerySchema })
      .get('/:id', GroupController.findOne)
      .put('/:id', GroupController.update, {
        body: updateGroupSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .delete('/:id', GroupController.delete, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .post('/:id/join', GroupController.joinGroup, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .post('/:id/leave', GroupController.leaveGroup, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .put('/:id/members/:userId/role', GroupController.updateMemberRole, {
        body: updateGroupMemberRoleSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      // Group Post Routes - using consistent :id parameter
      .post('/:id/posts', GroupController.createPost, {
        body: createGroupPostSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/:id/posts', GroupController.findAllPosts, { query: getGroupPostsQuerySchema })
      .get('/:id/posts/:postId', GroupController.findOnePost)
      .put('/:id/posts/:postId', GroupController.updatePost, {
        body: updateGroupPostSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .delete('/:id/posts/:postId', GroupController.deletePost, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
  );