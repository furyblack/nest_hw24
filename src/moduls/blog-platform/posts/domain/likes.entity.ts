import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../user-accounts/domain/user.entity';

@Entity('likes')
export class Likes {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  user_id: string;

  @Column({ type: 'character varying', nullable: false })
  user_login: string;

  @Column({ type: 'uuid', nullable: false })
  entity_id: string;

  @Column({ type: 'character varying', nullable: false })
  entity_type: string;

  @Column({ type: 'character varying' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
