import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManyToOne1754481016980 implements MigrationInterface {
  name = 'AddManyToOne1754481016980';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          DELETE FROM "likes"
          WHERE "user_id" NOT IN (SELECT id FROM "users");
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE "likes"
              ADD CONSTRAINT "FK_3f519ed95f775c781a254089171"
                  FOREIGN KEY ("user_id") REFERENCES "users"("id")
                      ON DELETE NO ACTION ON UPDATE NO ACTION
      `);
  }
}
