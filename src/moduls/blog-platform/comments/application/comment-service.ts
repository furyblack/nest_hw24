import { CommentViewDto, CreateCommentDto } from '../dto/create-comment-dto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostsService } from '../../posts/application/posts.service';
import { GetCommentsQueryDto } from '../dto/getCommentsDto';
import { Pagination } from '../../posts/dto/pagination.dto';
import { LikeStatusEnum } from '../../posts/dto/like-status.dto';
import { CommentsRepository } from '../infrastructure/comment-repository';

@Injectable()
export class CommentService {
  constructor(
    private readonly commentsRepo: CommentsRepository,
    private readonly postsService: PostsService,
  ) {}

  async createComment(
    postId: string,
    userId: string,
    userLogin: string,
    dto: CreateCommentDto,
  ): Promise<CommentViewDto> {
    // 1) Проверяем, что пост существует
    const post = await this.postsService.getPostById(postId);
    if (!post) throw new NotFoundException('Post not found');

    // 2) Вызываем new-репозиторий createComment
    return this.commentsRepo.createComment(
      postId,
      { id: userId, login: userLogin },
      dto,
    );
  }

  async getCommentById(
    commentId: string,
    currentUserId?: string,
  ): Promise<CommentViewDto> {
    const comment = await this.commentsRepo.findCommentById(
      commentId,
      currentUserId,
    );
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  async updateComment(
    commentId: string,
    content: string,
    userId: string,
  ): Promise<void> {
    // 1) Проверяем, что комментарий существует и получаем DTO
    const comment = await this.commentsRepo.findCommentById(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    // 2) Проверяем право
    if (comment.commentatorInfo.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this comment');
    }

    // 3) Обновляем контент
    await this.commentsRepo.updateContent(commentId, content);
  }

  async getCommentsForPost(
    postId: string,
    query: GetCommentsQueryDto,
    currentUserId: string,
  ): Promise<Pagination<CommentViewDto>> {
    // 1) Проверяем, что пост есть
    const post = await this.postsService.getPostById(postId);
    if (!post) throw new NotFoundException('Post not found');

    // 2) Получаем пагинированный список
    return this.commentsRepo.getCommentsForPost(postId, query, currentUserId);
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    // 1) Проверяем существование
    const comment = await this.commentsRepo.findCommentById(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    // 2) Проверяем право
    if (comment.commentatorInfo.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this comment');
    }

    // 3) Удаляем (soft-delete)
    await this.commentsRepo.deleteComment(commentId);
  }

  async likeComment(
    commentId: string,
    userId: string,
    userLogin: string,
    likeStatus: LikeStatusEnum,
  ): Promise<void> {
    // 1) Убедиться, что комментарий существует
    const comment = await this.commentsRepo.findCommentById(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    // 2) Обновить лайк-статус
    await this.commentsRepo.updateLikeStatus(
      commentId,
      { id: userId, login: userLogin },
      likeStatus,
    );
  }
}
