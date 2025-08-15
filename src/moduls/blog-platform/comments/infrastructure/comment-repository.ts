import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CommentViewDto, CreateCommentDto } from '../dto/create-comment-dto';
import { Post } from '../../posts/domain/post.entity';
import { Comment } from '../domain/comment.entity';
import { LikeStatusEnum } from '../../posts/dto/like-status.dto';
import { LikeStatus } from '../../posts/dto/like-types';
import { Likes } from '../../posts/domain/likes.entity';
import { GetCommentsQueryDto } from '../dto/get-comments-query.dto';

@Injectable()
export class CommentsRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly dataSource: DataSource,
    @InjectRepository(Likes)
    private readonly likeRepo: Repository<Likes>,
  ) {}

  async createComment(
    postId: string,
    user: { id: string; login: string },
    dto: CreateCommentDto,
  ): Promise<CommentViewDto> {
    const post = await this.dataSource
      .getRepository(Post)
      .findOneBy({ id: postId });
    if (!post) throw new NotFoundException('Post not found');

    const comment = this.commentRepository.create({
      content: dto.content,
      post,
      user,
      userLogin: user.login,
    });
    const saved = await this.commentRepository.save(comment);
    return this.mapToDto(saved, user.id);
  }
  private normalizeLikeStatus(status: string): LikeStatus {
    if (status === LikeStatus.Like) return LikeStatus.Like;
    if (status === LikeStatus.Dislike) return LikeStatus.Dislike;
    return LikeStatus.None;
  }

  async findCommentById(
    commentId: string,
    currentUserId?: string,
  ): Promise<CommentViewDto | null> {
    const comment = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .where('comment.id = :commentId', { commentId })
      .getOne();
    if (!comment) return null;

    let myStatus = LikeStatus.None;
    if (currentUserId) {
      const like = await this.likeRepo
        .createQueryBuilder('like')
        .select(['like.status'])
        .where('like.entity_id = :commentId', { commentId })
        .andWhere('like.user_id = :userId', { userId: currentUserId })
        .andWhere('like.entity_type = :type', { type: 'Comment' })
        .getOne();
      myStatus = this.normalizeLikeStatus(like?.status || LikeStatus.None);
    }
    const likesCount = await this.likeRepo
      .createQueryBuilder('like')
      .where('like.entity_id = :commentId', { commentId })
      .andWhere('like.entity_type = :type', { type: 'Comment' })
      .andWhere('like.status = :status', { status: LikeStatus.Like })
      .getCount();

    const dislikesCount = await this.likeRepo
      .createQueryBuilder('like')
      .where('like.entity_id = :commentId', { commentId })
      .andWhere('like.entity_type = :type', { type: 'Comment' })
      .andWhere('like.status = :status', { status: LikeStatus.Dislike })
      .getCount();

    return {
      id: comment.id,
      content: comment.content,
      commentatorInfo: {
        userId: comment.user.id,
        userLogin: comment.user.login,
      },
      createdAt: comment.createdAt.toISOString(),
      likesInfo: {
        likesCount,
        dislikesCount,
        myStatus,
      },
    };
  }

  // агрегируем лайки дизлайки по пачке  коментов
  private async getCommentLikeCounters(commentIds: string[]) {
    if (!commentIds.length) return {};
    const rows = await this.likeRepo
      .createQueryBuilder('l')
      .select('l.entity_id', 'entityId')
      .addSelect(
        `SUM(CASE WHEN l.status = :like THEN 1 ELSE 0 END)`,
        'likesCount',
      )
      .addSelect(
        `SUM(CASE WHEN l.status = :dislike THEN 1 ELSE 0 END)`,
        'dislikesCount',
      )
      .where('l.entity_id IN (:...ids)', { ids: commentIds })
      .andWhere('l.entity_type = :type', { type: 'Comment' })
      .groupBy('l.entity_id')
      .setParameters({ like: LikeStatus.Like, dislike: LikeStatus.Dislike })
      .getRawMany<{
        entityId: string;
        likesCount: string;
        dislikesCount: string;
      }>();

    const map: Record<string, { likesCount: number; dislikesCount: number }> =
      {};
    for (const r of rows) {
      map[r.entityId] = {
        likesCount: Number(r.likesCount) || 0,
        dislikesCount: Number(r.dislikesCount) || 0,
      };
    }
    return map;
  }

  //статусы текущего юзера по пачке коментов

  private async getUserCommentStatuses(commentIds: string[], userId: string) {
    if (!commentIds.length) return {};
    const rows = await this.likeRepo
      .createQueryBuilder('l')
      .select(['l.entity_id AS "entityId"', 'l.status AS "status"'])
      .where('l.entity_id IN (:...ids)', { ids: commentIds })
      .andWhere('l.entity_type = :type', { type: 'Comment' })
      .andWhere('l.user_id = :userId', { userId })
      // если теоретически может быть несколько записей берем самую свежую
      .orderBy('l.created_at', 'DESC')
      .getRawMany<{ entityId: string; status: LikeStatus }>();

    const map: Record<string, LikeStatus> = {};
    for (const r of rows) {
      if (!(r.entityId in map)) map[r.entityId] = r.status ?? LikeStatus.None;
    }
    return map;
  }

  async getCommentsForPost(
    postId: string,
    query: GetCommentsQueryDto,
    currentUserId?: string,
  ) {
    const exists = await this.dataSource
      .getRepository(Post)
      .exist({ where: { id: postId } });
    if (!exists) throw new NotFoundException('Post not found');

    const page = query.pageNumber ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const sortBy = ['content', 'createdAt'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortDir =
      query.sortDirection?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.commentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.post_id = :postId', { postId })
      .orderBy(`c.${sortBy}`, sortDir as 'ASC' | 'DESC')
      .skip(skip)
      .take(pageSize);

    const [items, totalCount] = await qb.getManyAndCount();
    const pagesCount = Math.ceil(totalCount / pageSize);

    const ids = items.map((c) => c.id);
    const [counters, userStatuses] = await Promise.all([
      this.getCommentLikeCounters(ids),
      currentUserId
        ? this.getUserCommentStatuses(ids, currentUserId)
        : Promise.resolve({}),
    ]);

    const dtos = items.map((c) => ({
      id: c.id,
      content: c.content,
      commentatorInfo: {
        userId: c.user.id,
        userLogin: c.user.login,
      },
      createdAt: c.createdAt.toISOString(),
      likesInfo: {
        likesCount: counters[c.id]?.likesCount ?? 0,
        dislikesCount: counters[c.id]?.dislikesCount ?? 0,
        myStatus: currentUserId
          ? (userStatuses[c.id] ?? LikeStatus.None)
          : LikeStatus.None,
      },
    }));

    return { pagesCount, page, pageSize, totalCount, items: dtos };
  }

  async updateContent(commentId: string, content: string): Promise<void> {
    const res = await this.commentRepository.update(commentId, { content });
    if (res.affected === 0) throw new NotFoundException('Comment not found');
  }

  async deleteComment(commentId: string): Promise<void> {
    const res = await this.commentRepository.delete(commentId);
    if (res.affected === 0) throw new NotFoundException('Comment not found');
  }

  async updateLikeStatus(
    commentId: string,
    user: { id: string; login: string },
    status: LikeStatusEnum,
  ): Promise<void> {
    const likeRepo = this.dataSource.getRepository('likes');
    const norm: LikeStatus =
      status === LikeStatusEnum.Like
        ? LikeStatus.Like
        : status === LikeStatusEnum.Dislike
          ? LikeStatus.Dislike
          : LikeStatus.None;

    const existing = await likeRepo.findOneBy({
      user_id: user.id,
      entity_id: commentId,
      entity_type: 'Comment',
    });

    if (norm === LikeStatus.None) {
      if (existing) await likeRepo.delete(existing);
      return;
    }

    if (existing) {
      await likeRepo.update(existing, { status: norm });
    } else {
      await likeRepo.insert({
        id: undefined,
        user_id: user.id,
        user_login: user.login,
        entity_id: commentId,
        entity_type: 'Comment',
        status: norm,
        created_at: new Date(),
      });
    }
  }

  private mapToDto(comment: Comment, currentUserId?: string): CommentViewDto {
    const likes = (comment as any).likesCount ?? 0;
    const dislikes = (comment as any).dislikesCount ?? 0;
    let myStatus: LikeStatus = LikeStatus.None;

    if (currentUserId) {
      // если в Comment есть поле myStatus, он уже джойнится
      myStatus = (comment as any).myStatus ?? LikeStatus.None;
    }

    return {
      id: comment.id,
      content: comment.content,
      commentatorInfo: {
        userId: comment.user.id,
        userLogin: comment.userLogin,
      },
      createdAt: comment.createdAt.toISOString(),
      likesInfo: {
        likesCount: likes,
        dislikesCount: dislikes,
        myStatus,
      },
    };
  }
}
