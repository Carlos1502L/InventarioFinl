import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditLogSchema } from '../src/schemas/auditSchemas.js';
import { inviteCollaboratorSchema } from '../src/schemas/collaboratorSchemas.js';
import { reportQuerySchema } from '../src/schemas/reportSchemas.js';

test('Zod DTO Security: createAuditLogSchema', async (t) => {
  await t.test('debe rechazar un inventory_id que no sea UUID', () => {
    const invalid = {
      inventory_id: 'not-a-uuid',
      action_type: 'PRODUCT_CREATE',
      details: 'Creación de prueba'
    };
    const result = createAuditLogSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  await t.test('debe aceptar payload válido y proveer metadata por defecto', () => {
    const valid = {
      inventory_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      action_type: 'PRODUCT_UPDATE',
      details: 'Actualización de stock'
    };
    const result = createAuditLogSchema.safeParse(valid);
    assert.equal(result.success, true);
    assert.deepEqual(result.data.metadata, {});
  });
});

test('Zod DTO Security: inviteCollaboratorSchema', async (t) => {
  await t.test('debe rechazar correos con formato inválido', () => {
    const invalid = {
      inventory_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'bad-email-format'
    };
    const result = inviteCollaboratorSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  await t.test('debe aceptar correo y aplicar rol collaborator por defecto', () => {
    const valid = {
      inventory_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'colaborador@ejemplo.com'
    };
    const result = inviteCollaboratorSchema.safeParse(valid);
    assert.equal(result.success, true);
    assert.equal(result.data.role, 'collaborator');
  });
});

test('Zod DTO Security: reportQuerySchema', async (t) => {
  await t.test('debe requerir un inventory_id válido', () => {
    const result = reportQuerySchema.safeParse({});
    assert.equal(result.success, false);
  });

  await t.test('debe rechazar estados no permitidos', () => {
    const invalid = {
      inventory_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'HACKED_STATUS'
    };
    const result = reportQuerySchema.safeParse(invalid);
    assert.equal(result.success, false);
  });
});
