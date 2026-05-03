import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../apps/api/dist/modules/users/entities/user.entity.js';
import { createMainDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createMainDataSource([UserEntity]);

const repository = dataSource.getRepository(UserEntity);
const email = `smoke-${randomUUID()}@example.com`;

try {
  const created = await repository.save(
    repository.create({
      fullName: 'Smoke Test User',
      email
    })
  );

  const found = await repository.findOneByOrFail({ id: created.id });
  const updated = await repository.save(
    repository.merge(found, {
      fullName: 'Smoke Test User Updated'
    })
  );

  const listed = await repository.find({
    where: { id: updated.id }
  });

  console.log(
    JSON.stringify(
      {
        created: {
          id: created.id,
          fullName: created.fullName,
          email: created.email
        },
        updated: {
          id: updated.id,
          fullName: updated.fullName,
          email: updated.email
        },
        listCount: listed.length
      },
      null,
      2
    )
  );

  await repository.delete({ id: updated.id });
} finally {
  await dataSource.destroy();
}
