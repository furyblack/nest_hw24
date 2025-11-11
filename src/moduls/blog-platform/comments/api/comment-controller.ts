import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../user-accounts/decarators/current-user';
import { CommentViewDto, UpdateCommentDto } from '../dto/create-comment-dto';
import { CommentService } from '../application/comment-service';
import { JwtAuthGuard } from '../../../user-accounts/guards/bearer/jwt-auth.guard';
import { LikeStatusDto } from '../../posts/dto/like-status.dto';
import { JwtOptionalAuthGuard } from '../../../user-accounts/guards/bearer/jwt-optional-guard';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentsService: CommentService) {}

  @Get(':id')
  @UseGuards(JwtOptionalAuthGuard)
  async getCommentById(
    @Param('id') id: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<CommentViewDto> {
    const comment = await this.commentsService.getCommentById(id, userId);
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateComment(
    @Param('id') commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentUser('userId') userId: string,
  ) {
    await this.commentsService.updateComment(
      commentId,
      updateCommentDto.content,
      userId,
    );
  } //cor push

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('id') commentId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.commentsService.deleteComment(commentId, userId);
  }

  @Put(':commentId/like-status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async likeComment(
    @Param('commentId') commentId: string,
    @Body() dto: LikeStatusDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('login') userLogin: string,
  ) {
    await this.commentsService.likeComment(
      commentId,
      userId,
      userLogin,
      dto.likeStatus,
    );
  }
}
