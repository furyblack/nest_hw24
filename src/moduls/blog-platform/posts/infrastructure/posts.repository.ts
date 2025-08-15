import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GetPostsQueryDto } from '../dto/get-posts-query.dto';

import { DeletionStatus, Post } from '../domain/post.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePostDto } from '../dto/create-post.dto';
import { Blog } from '../../blogs/domain/blog.entity';
import { Pagination } from '../dto/pagination.dto';
import { PostViewDto } from '../dto/posts-view.dto';
import { UpdatePostDto } from '../dto/update.post.dto';
import { LikeStatus } from '../likes/like.enum';
import { Likes } from '../domain/likes.entity';
import { NewestLike } from '../dto/like-types';

@Injectable()
export class PostsRepository {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly dataSource: DataSource,
    @InjectRepository(Likes)
    private readonly likeRepo: Repository<Likes>,
  ) {}

  async createPost(dto: CreatePostDto & { blog: Blog }): Promise<Post> {
    const post = this.postRepo.create({
      title: dto.title,
      shortDescription: dto.shortDescription,
      content: dto.content,
      blog: dto.blog,
    });

    return this.postRepo.save(post);
  }

  async getPostsByBlogId(
    blogId: string,
    query: GetPostsQueryDto,
    userId?: string,
  ): Promise<Pagination<PostViewDto>> {
    const {
      pageNumber = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const allowedSortFields = [
      'createdAt',
      'title',
      'shortDescription',
      'content',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.blog', 'blog')
      .where('post.blog_id = :blogId', { blogId })
      .andWhere('post.deletionStatus = :status', {
        status: DeletionStatus.ACTIVE,
      })
      .orderBy(
        `post.${safeSortBy}`,
        sortDirection.toUpperCase() as 'ASC' | 'DESC',
      )
      .skip((pageNumber - 1) * pageSize)
      .take(pageSize);

    const [items, totalCount] = await qb.getManyAndCount();

    //Запрос для лайков текущего пользвателя
    const userLikeStatuses = userId
      ? await this.getUserLikeStatuses(
          items.map((p) => p.id),
          userId,
        )
      : {};

    // Запрос для новейших лайков
    const newestLikes = await this.getNewestLikes(items.map((p) => p.id));

    return {
      pagesCount: Math.ceil(totalCount / pageSize),
      page: pageNumber,
      pageSize,
      totalCount,
      items: items.map((post) => ({
        id: post.id,
        title: post.title,
        shortDescription: post.shortDescription,
        content: post.content,
        blogId: post.blog.id,
        blogName: post.blog.name,
        createdAt: post.createdAt.toISOString(),
        extendedLikesInfo: {
          likesCount: post.likesCount || 0,
          dislikesCount: post.dislikesCount || 0,
          myStatus: userId
            ? userLikeStatuses[post.id] || LikeStatus.None
            : LikeStatus.None,
          newestLikes: newestLikes[post.id] || [],
        },
      })),
    };
  }

  private async getUserLikeStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Record<string, LikeStatus>> {
    const likes = await this.likeRepo
      .createQueryBuilder('like')
      .select(['like.entity_id as "postId"', 'like.status as "status"'])
      .where('like.entity_id IN (:...postIds)', { postIds })
      .andWhere('like.user_id = :userId', { userId })
      .andWhere('like.entity_type = :type', { type: 'Post' })
      .getRawMany();

    return likes.reduce((acc, curr) => {
      acc[curr.postId] = this.normalizeLikeStatus(curr.status);
      return acc;
    }, {});
  }

  private normalizeLikeStatus(status: string): LikeStatus {
    if (status === LikeStatus.Like) return LikeStatus.Like;
    if (status === LikeStatus.Dislike) return LikeStatus.Dislike;
    return LikeStatus.None;
  }

  private async getNewestLikes(
    postIds: string[],
  ): Promise<Record<string, NewestLike[]>> {
    const subQuery = this.likeRepo
      .createQueryBuilder('like')
      .select([
        'like.entity_id as "postId"',
        'like.user_id as "userId"',
        'like.user_login as "login"',
        'like.created_at as "addedAt"',
        'ROW_NUMBER() OVER (PARTITION BY like.entity_id ORDER BY like.created_at DESC) as row_num',
      ])
      .where('like.entity_id IN (:...postIds)', { postIds })
      .andWhere('like.entity_type = :type', { type: 'Post' })
      .andWhere('like.status = :status', { status: LikeStatus.Like });

    //основной запрос выбирающий топ 3 для каждого поста

    const newestLikes = await this.dataSource
      .createQueryBuilder()
      .select(['"postId"', '"userId"', '"login"', '"addedAt"'])
      .from(`(${subQuery.getQuery()})`, 'ranked_likes')
      .where('row_num<=3')
      .setParameters(subQuery.getParameters())
      .getRawMany();

    return newestLikes.reduce((acc, curr) => {
      if (!acc[curr.postId]) {
        acc[curr.postId] = [];
      }
      acc[curr.postId].push({
        addedAt: curr.addedAt.toISOString(),
        userId: curr.userId,
        login: curr.login,
      });
      return acc;
    }, {});
  }

  async getAllPostsWithPagination(
    query: GetPostsQueryDto,
    userId?: string,
  ): Promise<Pagination<PostViewDto>> {
    const {
      pageNumber = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const allowedSortFields = [
      'createdAt',
      'title',
      'shortDescription',
      'content',
      'blogName',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.blog', 'blog')
      .where('post.deletionStatus = :status', {
        status: DeletionStatus.ACTIVE,
      });

    if (safeSortBy === 'blogName') {
      qb.orderBy('blog.name', sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      qb.orderBy(
        `post.${safeSortBy}`,
        sortDirection.toUpperCase() as 'ASC' | 'DESC',
      );
    }
    qb.skip((pageNumber - 1) * pageSize).take(pageSize);

    const [items, totalCount] = await qb.getManyAndCount();

    //получаем статусы лайков текущего пользователя
    console.log('fffffffffffffffff', userId);
    const userLikeStatuses = userId
      ? await this.getUserLikeStatuses(
          items.map((p) => p.id),
          userId,
        )
      : {};

    const newestLikes = await this.getNewestLikes(items.map((p) => p.id));

    return {
      pagesCount: Math.ceil(totalCount / pageSize),
      page: pageNumber,
      pageSize,
      totalCount,
      items: items.map((post) => ({
        id: post.id,
        title: post.title,
        shortDescription: post.shortDescription,
        content: post.content,
        blogId: post.blog.id,
        blogName: post.blog.name,
        createdAt: post.createdAt.toISOString(),
        extendedLikesInfo: {
          likesCount: post.likesCount || 0,
          dislikesCount: post.dislikesCount || 0,
          myStatus: userId
            ? userLikeStatuses[post.id] || LikeStatus.None
            : LikeStatus.None,
          newestLikes: newestLikes[post.id] || [],
        },
      })),
    };
  }

  async findPostById(
    postId: string,
    userId?: string,
  ): Promise<PostViewDto | null> {
    const post = await this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.blog', 'blog')
      .where('post.id = :postId', { postId })
      .andWhere('post.deletionStatus = :status', {
        status: DeletionStatus.ACTIVE,
      })
      .getOne();

    if (!post) return null;

    let myStatus = LikeStatus.None;
    if (userId) {
      const like = await this.likeRepo
        .createQueryBuilder('like')
        .select(['like.status'])
        .where('like.entity_id = :postId', { postId })
        .andWhere('like.user_id = :userId', { userId })
        .andWhere('like.entity_type = :type', { type: 'Post' })
        .getOne();

      myStatus = this.normalizeLikeStatus(like?.status || LikeStatus.None);
    }

    const newestLikes = await this.likeRepo
      .createQueryBuilder('like')
      .select([
        'like.user_id as "userId"',
        'like.user_login as "login"',
        'like.created_at as "addedAt"',
      ])
      .where('like.entity_id = :postId', { postId })
      .andWhere('like.entity_type = :type', { type: 'Post' })
      .andWhere('like.status = :status', { status: LikeStatus.Like })
      .orderBy('like.created_at', 'DESC')
      .limit(3)
      .getRawMany();

    return {
      id: post.id,
      title: post.title,
      shortDescription: post.shortDescription,
      content: post.content,
      blogId: post.blog.id,
      blogName: post.blog.name,
      createdAt: post.createdAt.toISOString(),
      extendedLikesInfo: {
        likesCount: post.likesCount || 0,
        dislikesCount: post.dislikesCount || 0,
        myStatus,
        newestLikes: newestLikes.map((like) => ({
          addedAt: like.addedAt.toISOString(),
          userId: like.userId,
          login: like.login,
        })),
      },
    };
  }

  async updatePost(
    postId: string,
    blogId: string,
    dto: UpdatePostDto,
  ): Promise<boolean> {
    const result = await this.postRepo
      .createQueryBuilder()
      .update(Post)
      .set({
        title: dto.title,
        shortDescription: dto.shortDescription,
        content: dto.content,
      })
      .where('id = :postId AND blog_id = :blogId', { postId, blogId })
      .execute();

    return result.affected > 0;
  }

  async deletePost(postId: string, blogId: string): Promise<boolean> {
    const result = await this.postRepo
      .createQueryBuilder()
      .update(Post)
      .set({ deletionStatus: DeletionStatus.DELETED })
      .where('id = :postId AND blog_id = :blogId', { postId, blogId })
      .execute();

    return result.affected > 0;
  }

  async updateLikeForPost(
    postId: string,
    userId: string,
    userLogin: string,
    status: string,
  ): Promise<void> {
    const normalizedStatus = this.normalizeLikeStatus(status);

    await this.dataSource.transaction(async (manager) => {
      const likeRepo = manager.getRepository(Likes);
      const postRepo = manager.getRepository(Post);

      // Находим текущий лайк пользователя
      const currentLike = await likeRepo.findOne({
        where: {
          user_id: userId,
          entity_id: postId,
          entity_type: 'Post',
        },
      });

      // Если лайк уже существует, обновляем счетчики
      if (currentLike) {
        // Уменьшаем старый счетчик
        await postRepo
          .createQueryBuilder()
          .update(Post)
          .set({
            [currentLike.status === 'Like' ? 'likesCount' : 'dislikesCount']:
              () =>
                `${currentLike.status === 'Like' ? 'likesCount' : 'dislikesCount'} - 1`,
          })
          .where('id = :postId', { postId })
          .execute();

        // Удаляем старый лайк
        await likeRepo.remove(currentLike);
      }

      // Если новый статус не None, добавляем новый лайк
      if (normalizedStatus !== 'None') {
        const newLike = likeRepo.create({
          entity_type: 'Post',
          entity_id: postId,
          user_id: userId,
          user_login: userLogin,
          status: normalizedStatus,
        });

        await likeRepo.save(newLike);

        // Увеличиваем новый счетчик
        await postRepo
          .createQueryBuilder()
          .update(Post)
          .set({
            [normalizedStatus === 'Like' ? 'likesCount' : 'dislikesCount']:
              () =>
                `${normalizedStatus === 'Like' ? 'likesCount' : 'dislikesCount'} + 1`,
          })
          .where('id = :postId', { postId })
          .execute();
      }
    });
  }
}
