import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileService } from './services/ProfileService.ts';

test('ProfileService creates and removes duplicated profiles cleanly while keeping at least one', async () => {
  const uid = `test_user_${Date.now()}`;

  // Initial list creates default profile
  const initial = ProfileService.list(uid, 'Principal');
  assert.equal(initial.length, 1);

  // Create a duplicate profile with same name
  const dup = await ProfileService.create(uid, {
    id: `prof_dup_${Date.now()}`,
    name: 'Principal',
    avatarId: 'avatar_cartoon_hero',
    isKids: false,
  });
  assert.equal(dup.name, 'Principal');

  const afterCreate = ProfileService.list(uid, 'Principal');
  assert.equal(afterCreate.length, 2);

  // Delete the duplicated profile
  const removed = await ProfileService.remove(uid, dup.id);
  assert.equal(removed, true);

  const afterDelete = ProfileService.list(uid, 'Principal');
  assert.equal(afterDelete.length, 1);

  // Cannot delete the final remaining profile
  await assert.rejects(
    () => ProfileService.remove(uid, afterDelete[0].id),
    /pelo menos um perfil ativo/
  );
});
