import { Injectable } from '@nestjs/common';
import { BlogsRepository } from '../infrastructure/blogs.repository';
import { CreateBlogDto, UpdateBlogDto } from '../dto/create-blog.dto';

@Injectable()
export class BlogsService {
  constructor(private blogsRepository: BlogsRepository) {}
  async createBlog(dto: CreateBlogDto) {
    return this.blogsRepository.createBlog(dto);
  }

  async updateBlog(id: string, dto: UpdateBlogDto): Promise<void> {
    await this.blogsRepository.updateBlog(id, dto);
  }

  async deleteBlog(id: string): Promise<void> {
    await this.blogsRepository.deleteBlog(id);
  }
}
