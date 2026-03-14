import { describe, it, expect } from 'vitest';
import {
  buildApplyWritesOp,
  generateTid,
  isPdsRecordNotFound,
  handlePdsError,
  type ApplyWritesCreate,
  type ApplyWritesUpdate,
} from '../../src/services/pds-writer.js';

describe('PDS writer', () => {
  it('builds create operation', () => {
    const op = buildApplyWritesOp('create', 'id.sifa.profile.position', '3abc', {
      title: 'Engineer',
    });
    expect(op.$type).toBe('com.atproto.repo.applyWrites#create');
    expect(op.collection).toBe('id.sifa.profile.position');
    expect(op.rkey).toBe('3abc');
    expect((op as ApplyWritesCreate).value).toBeDefined();
    expect((op as ApplyWritesCreate).value.title).toBe('Engineer');
  });

  it('builds update operation', () => {
    const op = buildApplyWritesOp('update', 'id.sifa.profile.position', '3abc', {
      title: 'Senior Engineer',
    });
    expect(op.$type).toBe('com.atproto.repo.applyWrites#update');
    expect(op.collection).toBe('id.sifa.profile.position');
    expect(op.rkey).toBe('3abc');
    expect((op as ApplyWritesUpdate).value).toBeDefined();
    expect((op as ApplyWritesUpdate).value.title).toBe('Senior Engineer');
  });

  it('builds delete operation', () => {
    const op = buildApplyWritesOp('delete', 'id.sifa.profile.position', '3abc');
    expect(op.$type).toBe('com.atproto.repo.applyWrites#delete');
    expect(op.collection).toBe('id.sifa.profile.position');
    expect(op.rkey).toBe('3abc');
    expect('value' in op).toBe(false);
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
    expect((op as ApplyWritesCreate).value.$type).toBe('id.sifa.profile.skill');
  });

  describe('isPdsRecordNotFound', () => {
    it('returns true for PDS record-not-found error', () => {
      const err = Object.assign(new Error('Could not find record'), {
        status: 400,
        error: 'InvalidRequest',
      });
      expect(isPdsRecordNotFound(err)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isPdsRecordNotFound(new Error('Network error'))).toBe(false);
      expect(isPdsRecordNotFound('string error')).toBe(false);
    });

    it('returns false for non-matching status', () => {
      const err = Object.assign(new Error('Could not find record'), {
        status: 500,
        error: 'InvalidRequest',
      });
      expect(isPdsRecordNotFound(err)).toBe(false);
    });
  });

  describe('handlePdsError', () => {
    it('returns structured error for XRPC errors', () => {
      const err = Object.assign(new Error('Token expired'), {
        status: 401,
        error: 'AuthRequired',
      });
      const reply = {
        status: (code: number) => {
          expect(code).toBe(401);
          return reply;
        },
        send: (body: unknown) => {
          expect(body).toEqual({ error: 'AuthRequired', message: 'Token expired' });
          return reply;
        },
      };
      handlePdsError(err, reply as never);
    });

    it('re-throws non-XRPC errors', () => {
      expect(() => handlePdsError(new TypeError('bad'), {} as never)).toThrow('bad');
    });
  });
});
