import { IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(20, 300)
  content: string;
}
export class CommentatorInfoDto {
  userId: string;
  userLogin: string;
}

export class LikesInfoDto {
  likesCount: number;
  dislikesCount: number;
  myStatus: 'None' | 'Like' | 'Dislike';
}

export class CommentViewDto {
  id: string;
  content: string;
  commentatorInfo: CommentatorInfoDto;
  createdAt: string; // ISO string
  likesInfo: LikesInfoDto;
}

export class UpdateCommentDto {
  @IsString()
  @Length(20, 300)
  content: string;
}
