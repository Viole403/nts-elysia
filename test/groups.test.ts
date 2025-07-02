import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { GroupMemberRole, GroupVisibility, UserRole } from '@prisma/client';
import { redis } from '../src/plugins/redis.plugin';

// Mock Prisma and RedisPublisher
const mockPrisma = {
  group: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  groupMembership: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  groupPost: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockRedis = {
  publish: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
redis = mockRedis;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';
const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';

describe('Groups Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /groups', () => {
    it('should create a new group successfully', async () => {
      const newGroup = {
        name: 'Test Group',
        description: 'A group for testing',
        visibility: GroupVisibility.PUBLIC,
      };

      mockPrisma.group.create.mockResolvedValue({
        id: 'group1',
        ...newGroup,
        members: [{ userId: 'userId123', role: GroupMemberRole.ADMIN }],
      });

      const response = await app.handle(
        new Request('http://localhost/groups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newGroup),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe(newGroup.name);
      expect(mockPrisma.group.create).toHaveBeenCalledWith({
        data: {
          name: newGroup.name,
          description: newGroup.description,
          visibility: newGroup.visibility,
          members: {
            create: {
              userId: 'userId123',
              role: GroupMemberRole.ADMIN,
            },
          },
        },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const newGroup = {
        name: 'Test Group',
        description: 'A group for testing',
        visibility: GroupVisibility.PUBLIC,
      };

      const response = await app.handle(
        new Request('http://localhost/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newGroup),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /groups', () => {
    it('should return a list of groups', async () => {
      const mockGroups = [
        { id: 'g1', name: 'Group 1', visibility: GroupVisibility.PUBLIC, members: [] },
        { id: 'g2', name: 'Group 2', visibility: GroupVisibility.PRIVATE, members: [] },
      ];
      mockPrisma.group.findMany.mockResolvedValue(mockGroups);
      mockPrisma.group.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request('http://localhost/groups', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.groups).toEqual(mockGroups);
      expect(body.total).toBe(2);
    });
  });

  describe('GET /groups/:id', () => {
    it('should return a single group', async () => {
      const mockGroup = { id: 'g1', name: 'Group 1', visibility: GroupVisibility.PUBLIC, members: [], posts: [] };
      mockPrisma.group.findUnique.mockResolvedValue(mockGroup);

      const response = await app.handle(
        new Request('http://localhost/groups/g1', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Group 1');
      expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({ where: { id: 'g1' }, include: { members: true, posts: true } });
    });

    it('should return 404 if group not found', async () => {
      mockPrisma.group.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/groups/non-existent-group', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /groups/:id', () => {
    it('should update a group successfully by admin', async () => {
      const groupId = 'group1';
      const existingGroup = { id: groupId, name: 'Old Name', members: [{ userId: 'userId123', role: GroupMemberRole.ADMIN }] };
      const updatedData = { name: 'New Name', description: 'Updated description' };

      mockPrisma.group.findUnique.mockResolvedValue(existingGroup);
      mockPrisma.group.update.mockResolvedValue({ ...existingGroup, ...updatedData });

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('New Name');
      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: groupId },
        data: updatedData,
      });
    });

    it('should return 403 if user is not group admin or platform admin', async () => {
      const groupId = 'group1';
      const existingGroup = { id: groupId, name: 'Old Name', members: [{ userId: 'otherUser', role: GroupMemberRole.MEMBER }] };
      const updatedData = { name: 'New Name' };

      mockPrisma.group.findUnique.mockResolvedValue(existingGroup);

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /groups/:id', () => {
    it('should delete a group successfully by admin', async () => {
      const groupId = 'group1';
      const existingGroup = { id: groupId, name: 'Group to Delete', members: [{ userId: 'userId123', role: GroupMemberRole.ADMIN }] };

      mockPrisma.group.findUnique.mockResolvedValue(existingGroup);
      mockPrisma.group.delete.mockResolvedValue(existingGroup);

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(groupId);
      expect(mockPrisma.group.delete).toHaveBeenCalledWith({ where: { id: groupId } });
    });

    it('should return 403 if user is not group admin or platform admin', async () => {
      const groupId = 'group1';
      const existingGroup = { id: groupId, name: 'Group to Delete', members: [{ userId: 'otherUser', role: GroupMemberRole.MEMBER }] };

      mockPrisma.group.findUnique.mockResolvedValue(existingGroup);

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /groups/:id/join', () => {
    it('should join a group successfully', async () => {
      const groupId = 'group1';
      mockPrisma.groupMembership.findUnique.mockResolvedValue(null);
      mockPrisma.groupMembership.create.mockResolvedValue({ groupId, userId: 'userId123', role: GroupMemberRole.MEMBER });

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}/join`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.groupId).toBe(groupId);
      expect(body.userId).toBe('userId123');
      expect(mockPrisma.groupMembership.create).toHaveBeenCalledWith({
        data: { groupId, userId: 'userId123', role: GroupMemberRole.MEMBER },
      });
    });

    it('should return 409 if already a member', async () => {
      const groupId = 'group1';
      mockPrisma.groupMembership.findUnique.mockResolvedValue({ groupId, userId: 'userId123' });

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}/join`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.message).toBe('Already a member of this group.');
    });
  });

  describe('POST /groups/:id/leave', () => {
    it('should leave a group successfully', async () => {
      const groupId = 'group1';
      mockPrisma.groupMembership.delete.mockResolvedValue({ groupId, userId: 'userId123' });

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}/leave`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.groupId).toBe(groupId);
      expect(body.userId).toBe('userId123');
      expect(mockPrisma.groupMembership.delete).toHaveBeenCalledWith({
        where: {
          groupId_userId: {
            groupId,
            userId: 'userId123',
          },
        },
      });
    });
  });

  describe('PUT /groups/:id/members/:userId/role', () => {
    it('should update member role successfully by group admin', async () => {
      const groupId = 'group1';
      const targetUserId = 'memberId456';
      const newRole = GroupMemberRole.ADMIN;
      const existingGroup = { id: groupId, members: [{ userId: 'userId123', role: GroupMemberRole.ADMIN }] };

      mockPrisma.group.findUnique.mockResolvedValue(existingGroup);
      mockPrisma.groupMembership.update.mockResolvedValue({ groupId, userId: targetUserId, role: newRole });

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}/members/${targetUserId}/role`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ role: newRole }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.role).toBe(newRole);
      expect(mockPrisma.groupMembership.update).toHaveBeenCalledWith({
        where: {
          groupId_userId: {
            groupId,
            userId: targetUserId,
          },
        },
        data: { role: newRole },
      });
    });

    it('should return 403 if user is not group admin or platform admin', async () => {
      const groupId = 'group1';
      const targetUserId = 'memberId456';
      const newRole = GroupMemberRole.ADMIN;
      const existingGroup = { id: groupId, members: [{ userId: 'userId123', role: GroupMemberRole.MEMBER }] };

      mockPrisma.group.findUnique.mockResolvedValue(existingGroup);

      const response = await app.handle(
        new Request(`http://localhost/groups/${groupId}/members/${targetUserId}/role`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ role: newRole }),
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('Group Posts', () => {
    describe('POST /groups/:groupId/posts', () => {
      it('should create a new group post successfully', async () => {
        const groupId = 'group1';
        const newPostContent = { content: 'This is a new group post.' };

        mockPrisma.groupMembership.findUnique.mockResolvedValue({ groupId, userId: 'userId123', role: GroupMemberRole.MEMBER });
        mockPrisma.groupPost.create.mockResolvedValue({
          id: 'post1',
          groupId,
          authorId: 'userId123',
          ...newPostContent,
        });
        mockRedis.publish.mockResolvedValue(1);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mockUserToken}`,
              },
              body: JSON.stringify(newPostContent),
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.content).toBe(newPostContent.content);
        expect(mockPrisma.groupPost.create).toHaveBeenCalledWith({
          data: {
            groupId,
            authorId: 'userId123',
            content: newPostContent.content,
          },
        });
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `group:${groupId}:posts`,
          JSON.stringify({ type: 'NEW_POST', post: expect.any(Object) })
        );
      });

      it('should return 403 if user is not a member of the group', async () => {
        const groupId = 'group1';
        const newPostContent = { content: 'This is a new group post.' };

        mockPrisma.groupMembership.findUnique.mockResolvedValue(null);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mockUserToken}`,
              },
              body: JSON.stringify(newPostContent),
            })
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GET /groups/:groupId/posts', () => {
      it('should return a list of group posts', async () => {
        const groupId = 'group1';
        const mockPosts = [
          { id: 'p1', content: 'Post 1', author: { username: 'user1' } },
          { id: 'p2', content: 'Post 2', author: { username: 'user2' } },
        ];
        mockPrisma.group.findUnique.mockResolvedValue({ id: groupId, visibility: GroupVisibility.PUBLIC });
        mockPrisma.groupPost.findMany.mockResolvedValue(mockPosts);
        mockPrisma.groupPost.count.mockResolvedValue(2);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts`,
            {
              method: 'GET',
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.posts).toEqual(mockPosts);
        expect(body.total).toBe(2);
        expect(mockPrisma.groupPost.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { groupId },
        }));
      });

      it('should return 403 for private group posts if not a member', async () => {
        const groupId = 'group1';
        mockPrisma.group.findUnique.mockResolvedValue({ id: groupId, visibility: GroupVisibility.PRIVATE });
        mockPrisma.groupMembership.findUnique.mockResolvedValue(null);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${mockUserToken}`,
              },
            })
        );

        expect(response.status).toBe(403);
      });
    });

    describe('PUT /groups/:groupId/posts/:postId', () => {
      it('should update a group post successfully by author', async () => {
        const groupId = 'group1';
        const postId = 'post1';
        const updatedContent = { content: 'Updated post content.' };
        const existingPost = { id: postId, groupId, authorId: 'userId123' };

        mockPrisma.group.findUnique.mockResolvedValue({ id: groupId, members: [{ userId: 'userId123', role: GroupMemberRole.MEMBER }] });
        mockPrisma.groupPost.findUnique.mockResolvedValue(existingPost);
        mockPrisma.groupPost.update.mockResolvedValue({ ...existingPost, ...updatedContent });
        mockRedis.publish.mockResolvedValue(1);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts/${postId}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mockUserToken}`,
              },
              body: JSON.stringify(updatedContent),
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.content).toBe(updatedContent.content);
        expect(mockPrisma.groupPost.update).toHaveBeenCalledWith({
          where: { id: postId, groupId },
          data: updatedContent,
        });
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `group:${groupId}:posts`,
          JSON.stringify({ type: 'UPDATED_POST', post: expect.any(Object) })
        );
      });

      it('should return 403 if user is not author, group admin/moderator, or platform admin', async () => {
        const groupId = 'group1';
        const postId = 'post1';
        const updatedContent = { content: 'Updated post content.' };
        const existingPost = { id: postId, groupId, authorId: 'otherUser' };

        mockPrisma.group.findUnique.mockResolvedValue({ id: groupId, members: [{ userId: 'userId123', role: GroupMemberRole.MEMBER }] });
        mockPrisma.groupPost.findUnique.mockResolvedValue(existingPost);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts/${postId}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mockUserToken}`,
              },
              body: JSON.stringify(updatedContent),
            })
        );

        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /groups/:groupId/posts/:postId', () => {
      it('should delete a group post successfully by author', async () => {
        const groupId = 'group1';
        const postId = 'post1';
        const existingPost = { id: postId, groupId, authorId: 'userId123' };

        mockPrisma.group.findUnique.mockResolvedValue({ id: groupId, members: [{ userId: 'userId123', role: GroupMemberRole.MEMBER }] });
        mockPrisma.groupPost.findUnique.mockResolvedValue(existingPost);
        mockPrisma.groupPost.delete.mockResolvedValue(existingPost);
        mockRedis.publish.mockResolvedValue(1);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts/${postId}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${mockUserToken}`,
              },
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.id).toBe(postId);
        expect(mockPrisma.groupPost.delete).toHaveBeenCalledWith({ where: { id: postId, groupId } });
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `group:${groupId}:posts`,
          JSON.stringify({ type: 'DELETED_POST', postId })
        );
      });

      it('should return 403 if user is not author, group admin/moderator, or platform admin', async () => {
        const groupId = 'group1';
        const postId = 'post1';
        const existingPost = { id: postId, groupId, authorId: 'otherUser' };

        mockPrisma.group.findUnique.mockResolvedValue({ id: groupId, members: [{ userId: 'userId123', role: GroupMemberRole.MEMBER }] });
        mockPrisma.groupPost.findUnique.mockResolvedValue(existingPost);

        const response = await app.handle(
          new Request(`http://localhost/groups/${groupId}/posts/${postId}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${mockUserToken}`,
              },
            })
        );

        expect(response.status).toBe(403);
      });
    });
  });
});