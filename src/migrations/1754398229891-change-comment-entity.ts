import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeCommentEntity1754398229891 implements MigrationInterface {
  name = 'ChangeCommentEntity1754398229891';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "userLogin2"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "userLogin2" character varying NOT NULL`,
    );
  }
}
