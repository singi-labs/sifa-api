import { describe, it, expect } from 'vitest';
import { buildApplyWritesOp, generateTid } from '../../src/services/pds-writer.js';

describe('PDS writer', () => {
  it('builds create operation', () => {
    const op = buildApplyWritesOp('create', 'id.sifa.profile.position', '3abc', {
      title: 'Engineer',
    });
    expect(op.$type).toBe('com.atproto.repo.applyWrites#create');
    expect(op.collection).toBe('id.sifa.profile.position');
    expect(op.rkey).toBe('3abc');
    expect((op as any).value).toBeDefined();
    expect((op as any).value.title).toBe('Engineer');
  });

  it('builds update operation', () => {
    const op = buildApplyWritesOp('update', 'id.sifa.profile.position', '3abc', {
      title: 'Senior Engineer',
    });
    expect(op.$type).toBe('com.atproto.repo.applyWrites#update');
    expect(op.collection).toBe('id.sifa.profile.position');
    expect(op.rkey).toBe('3abc');
    expect((op as any).value).toBeDefined();
    expect((op as any).value.title).toBe('Senior Engineer');
  });

  it('builds delete operation', () => {
    const op = buildApplyWritesOp('delete', 'id.sifa.profile.position', '3abc');
    expect(op.$type).toBe('com.atproto.repo.applyWrites#delete');
    expect(op.collection).toBe('id.sifa.profile.position');
    expect(op.rkey).toBe('3abc');
    expect((op as any).value).toBeUndefined();
  });

  it('generates unique TIDs', () => {
    const tid1 = generateTid();
    const tid2 = generateTid();
    expect(tid1).not.toBe(tid2);
    expect(tid1.length).toBe(13);
    expect(tid2.length).toBe(13);
  });

  it('sets $type on record value matching collection', () => {
    const op = buildApplyWritesOp('create', 'id.sifa.profile.skill', '3xyz', {
      name: 'TypeScript',
    });
    expect((op as any).value.$type).toBe('id.sifa.profile.skill');
  });
});
