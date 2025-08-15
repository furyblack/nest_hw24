import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CommentViewDto, CreateCommentDto } from '../dto/create-comment-dto';
import { Post } from '../../posts/domain/post.entity';
import { Comment } from '../domain/comment.entity';
import { GetCommentsQueryDto } from '../dto/get-comments-query.dto';
import { LikeStatusEnum } from '../../posts/dto/like-status.dto';
import { LikeStatus } from '../../posts/dto/like-types';

@Injectable()
export class CommentsRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly repo: Repository<Comment>,
    private readonly dataSource: DataSource,
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

    const comment = this.repo.create({
      content: dto.content,
      post,
      user,
      userLogin: user.login,
    });
    const saved = await this.repo.save(comment);
    return this.mapToDto(saved, user.id);
  }

  async findCommentById(
    commentId: string,
    currentUserId?: string,
  ): Promise<CommentViewDto | null> {
    const comment = await this.repo.findOne({
      where: { id: commentId },
      relations: ['user', 'post'],
    });
    if (!comment) return null;
    return this.mapToDto(comment, currentUserId);
  }

  async getCommentsForPost(
    postId: string,
    query: GetCommentsQueryDto,
    currentUserId?: string,
  ) {
    // убедимся, что пост существует
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

    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.post_id = :postId', { postId })
      .orderBy(`c.${sortBy}`, sortDir)
      .skip(skip)
      .take(pageSize);

    const [items, totalCount] = await qb.getManyAndCount();
    const pagesCount = Math.ceil(totalCount / pageSize);
    const dtos = items.map((c) => this.mapToDto(c, currentUserId));
    return { pagesCount, page, pageSize, totalCount, items: dtos };
  }

  async updateContent(commentId: string, content: string): Promise<void> {
    const res = await this.repo.update(commentId, { content });
    if (res.affected === 0) throw new NotFoundException('Comment not found');
  }

  async deleteComment(commentId: string): Promise<void> {
    const res = await this.repo.delete(commentId);
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
