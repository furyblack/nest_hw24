import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Blog } from '../../blogs/domain/blog.entity';
import { User } from '../../../user-accounts/domain/user.entity';
import { Comment } from '../../comments/domain/comment.entity';

export enum DeletionStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
}

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  shortDescription: string;

  @Column('text')
  content: string;

  /** 🔗 Post → Blog */
  @ManyToOne(() => Blog, (blog) => blog.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blog_id' })
  blog: Blog;

  @Column({ type: 'uuid' })
  blog_id: string;

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @Column({ type: 'int', default: 0 })
  dislikesCount: number;

  /** 🔗 Post → User */
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 🔗 Post → Comments */
  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: DeletionStatus,
    default: DeletionStatus.ACTIVE,
  })
  deletionStatus: DeletionStatus;
}
