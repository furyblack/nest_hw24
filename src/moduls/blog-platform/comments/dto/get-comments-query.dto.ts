import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class GetCommentsQueryDto {
  @IsInt() @Min(1) @IsOptional() pageNumber?: number;
  @IsInt() @Min(1) @IsOptional() pageSize?: number;
  @IsOptional() @IsIn(['content', 'createdAt']) sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection?: string;
}
